const express = require('express');
const router = express.Router();
// Switch to MySQL adapter
const DatabaseWrapper = require('../db/mysql-database');
const { v4: uuidv4 } = require('uuid');

const db = new DatabaseWrapper();

/**
 * @swagger
 * components:
 *   schemas:
 *     Table:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           format: uuid
 *         name:
 *           type: string
 *         columns:
 *           type: array
 *           items:
 *             type: object
 *         created_at:
 *           type: string
 *           format: date-time
 *         updated_at:
 *           type: string
 *           format: date-time
 */

// 辅助函数：检测引用关系（包括字典子表和关联字段）
function checkDictReferences(allTables, targetTableId, targetColumnId = null) {
  const references = [];
  
  allTables.forEach(table => {
    try {
      if (typeof table.columns !== 'string') {
        console.warn(`Table ${table.id} has invalid columns format`);
        return;
      }
      
      const columns = JSON.parse(table.columns);
      
      if (!Array.isArray(columns)) {
        console.warn(`Table ${table.id} columns is not an array`);
        return;
      }
      
      columns.forEach(column => {
        if (!column || typeof column !== 'object') return;
        
        if (column.dictRef && 
            typeof column.dictRef === 'object' && 
            column.dictRef.tableId === targetTableId) {
              
          if (targetColumnId) {
            if (!column.dictRef.columnId || column.dictRef.columnId !== targetColumnId) {
              return;
            }
          }
          
          references.push({
            tableId: table.id,
            tableName: table.name,
            columnId: column.id,
            columnName: column.name,
            type: 'dictRef'
          });
        }
        
        if (column.relation && 
            typeof column.relation === 'object' && 
            column.relation.targetTableId === targetTableId) {
              
          if (targetColumnId) {
            if ((!column.relation.targetColumnId || column.relation.targetColumnId !== targetColumnId) &&
                (!column.relation.displayColumnId || column.relation.displayColumnId !== targetColumnId)) {
              return;
            }
          }
          
          references.push({
            tableId: table.id,
            tableName: table.name,
            columnId: column.id,
            columnName: column.name,
            type: 'relation'
          });
        }
      });
    } catch (err) {
      console.error('Error parsing columns for table', table.id, err);
    }
  });
  
  return references;
}

/**
 * @swagger
 * /tables:
 *   get:
 *     summary: Get all tables
 *     responses:
 *       200:
 *         description: List of tables
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Table'
 */
router.get('/', (req, res) => {
  db.getTables((err, tables) => {
    if (err) {
      console.error('Error getting tables:', err);
      return res.status(500).json({ error: 'Failed to get tables' });
    }

    const parsedTables = tables.map(table => ({
      ...table,
      columns: typeof table.columns === 'string' ? JSON.parse(table.columns) : table.columns
    }));

    res.json(parsedTables);
  });
});

/**
 * @swagger
 * /tables/{tableId}:
 *   get:
 *     summary: Get a single table
 *     parameters:
 *       - in: path
 *         name: tableId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Table details with rows
 *       404:
 *         description: Table not found
 */
router.get('/:tableId', (req, res) => {
  const { tableId } = req.params;

  db.getTable(tableId, (err, table) => {
    if (err) {
      console.error('Error getting table:', err);
      return res.status(500).json({ error: 'Failed to get table' });
    }

    if (!table) {
      return res.status(404).json({ error: 'Table not found' });
    }

    const columns = typeof table.columns === 'string' ? JSON.parse(table.columns) : table.columns;
    
    db.getTables((err, allTables) => {
      if (err) {
        console.error('Error getting all tables for relation processing:', err);
        return res.status(500).json({ error: 'Failed to process relations' });
      }

      db.getTableRows(tableId, (err, rows) => {
        if (err) {
          console.error('Error getting rows:', err);
          return res.status(500).json({ error: 'Failed to get rows' });
        }

        const parsedRows = rows.map(row => (typeof row.data === 'string' ? JSON.parse(row.data) : row.data));
        
        processRelationFields(allTables, columns, parsedRows)
          .then(rowsWithRelations => {
            const result = {
              ...table,
              columns: columns,
              rows: rowsWithRelations
            };

            res.json(result);
          })
          .catch(err => {
            console.error('Error processing relation fields:', err);
            const result = {
              ...table,
              columns: columns,
              rows: parsedRows
            };
            res.json(result);
          });
      });
    });
  });
});

function processRelationFields(allTables, columns, rows) {
  return new Promise((resolve, reject) => {
    try {
      const relationColumns = columns.filter(col => col.relation && typeof col.relation === 'object');
      
      if (relationColumns.length === 0) {
        return resolve(rows);
      }

      const tablesMap = {};
      allTables.forEach(table => {
        try {
          tablesMap[table.id] = {
            ...table,
            columns: typeof table.columns === 'string' ? JSON.parse(table.columns) : table.columns
          };
        } catch (e) {
          console.warn(`Failed to parse columns for table ${table.id}`);
        }
      });

      const targetTableIds = new Set();
      relationColumns.forEach(col => {
        if (tablesMap[col.relation.targetTableId]) {
          targetTableIds.add(col.relation.targetTableId);
        }
      });

      if (targetTableIds.size === 0) {
        return resolve(rows);
      }

      const targetTablesData = {};
      let pendingQueries = targetTableIds.size;

      function handleAllDataFetched() {
        try {
          const processedRows = rows.map(row => {
            const processedRow = { ...row };
            
            relationColumns.forEach(col => {
              const relationData = col.relation;
              const targetTable = tablesMap[relationData.targetTableId];
              
              if (!targetTable || !targetTablesData[relationData.targetTableId]) {
                return;
              }
              
              const targetColumn = relationData.targetColumnId;
              const displayColumn = relationData.displayColumnId || targetColumn;
              const isMultiSelect = relationData.multiSelect;
              
              const relationValue = row[col.id];
              
              if (!relationValue) {
                return;
              }

              if (isMultiSelect && Array.isArray(relationValue)) {
                const relatedItems = [];
                
                relationValue.forEach(id => {
                  const matchedRow = targetTablesData[relationData.targetTableId].find(
                    item => item[targetColumn] === id
                  );
                  
                  if (matchedRow) {
                    relatedItems.push({
                      id: matchedRow[targetColumn],
                      display: matchedRow[displayColumn],
                      data: matchedRow
                    });
                  }
                });
                
                processedRow[`${col.id}_relation`] = relatedItems;
              } else {
                const matchedRow = targetTablesData[relationData.targetTableId].find(
                  item => item[targetColumn] === relationValue
                );
                
                if (matchedRow) {
                  processedRow[`${col.id}_relation`] = {
                    id: matchedRow[targetColumn],
                    display: matchedRow[displayColumn],
                    data: matchedRow
                  };
                }
              }
            });
            
            return processedRow;
          });
          
          resolve(processedRows);
        } catch (e) {
          reject(e);
        }
      }

      targetTableIds.forEach(tableId => {
        db.getTableRows(tableId, (err, targetRows) => {
          pendingQueries--;
          
          if (!err && targetRows) {
            targetTablesData[tableId] = targetRows.map(row => {
              try {
                return typeof row.data === 'string' ? JSON.parse(row.data) : row.data;
              } catch (e) {
                console.warn(`Failed to parse data for row in table ${tableId}`);
                return {};
              }
            });
          }
          
          if (pendingQueries === 0) {
            handleAllDataFetched();
          }
        });
      });
    } catch (e) {
      reject(e);
    }
  });
}

/**
 * @swagger
 * /tables:
 *   post:
 *     summary: Create a new table
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               columns:
 *                 type: array
 *     responses:
 *       201:
 *         description: Table created
 */
router.post('/', (req, res) => {
  const { name, columns } = req.body;

  if (!name || !columns) {
    return res.status(400).json({ error: 'Name and columns are required' });
  }

  const tableData = {
    id: uuidv4(),
    name,
    columns
  };

  db.createTable(tableData, (err) => {
    if (err) {
      console.error('Error creating table:', err);
      return res.status(500).json({ error: 'Failed to create table' });
    }

    res.status(201).json({ message: 'Table created successfully', table: tableData });
  });
});

/**
 * @swagger
 * /tables/{tableId}:
 *   put:
 *     summary: Update a table structure
 *     parameters:
 *       - in: path
 *         name: tableId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       200:
 *         description: Table updated
 */
router.put('/:tableId', (req, res) => {
  const { tableId } = req.params;
  const { name, columns } = req.body;
  const { confirmed = false } = req.query;

  if (!name || !columns) {
    return res.status(400).json({ error: 'Name and columns are required' });
  }

  db.getTables((err, allTables) => {
    if (err) {
      console.error('Error getting tables for reference check:', err);
      return res.status(500).json({ error: 'Failed to check references' });
    }

    const currentTable = allTables.find(t => t.id === tableId);
    if (!currentTable) {
      return res.status(404).json({ error: 'Table not found' });
    }

    const oldColumns = typeof currentTable.columns === 'string' ? JSON.parse(currentTable.columns) : currentTable.columns;
    const newColumnIds = new Set(columns.map(col => col.id));
    
    const deletedColumns = oldColumns.filter(col => !newColumnIds.has(col.id));
    
    const references = [];
    deletedColumns.forEach(deletedCol => {
      const colReferences = checkDictReferences(allTables, tableId, deletedCol.id);
      if (colReferences.length > 0) {
        references.push({
          columnName: deletedCol.name,
          references: colReferences
        });
      }
    });

    if (references.length > 0 && !confirmed) {
      return res.status(200).json({
        needsConfirmation: true,
        message: '删除这些列将影响其他表格的字典子表设置',
        references: references
      });
    }

    if (references.length > 0) {
      const tablesToUpdate = new Set();
      references.forEach(refGroup => {
        refGroup.references.forEach(ref => {
          tablesToUpdate.add(ref.tableId);
        });
      });

      tablesToUpdate.forEach(refTableId => {
        const refTable = allTables.find(t => t.id === refTableId);
        if (refTable) {
          try {
            const refColumns = typeof refTable.columns === 'string' ? JSON.parse(refTable.columns) : refTable.columns;
            const updatedColumns = refColumns.map(column => {
              if (column.dictRef && typeof column.dictRef === 'object' && column.dictRef.tableId === tableId) {
                const isReferencingDeletedColumn = deletedColumns.some(
                  deletedCol => column.dictRef.columnId === deletedCol.id
                );
                if (isReferencingDeletedColumn) {
                  return { ...column, dictRef: undefined };
                }
              }
              
              if (column.relation && typeof column.relation === 'object' && column.relation.targetTableId === tableId) {
                const isReferencingDeletedColumn = deletedColumns.some(
                  deletedCol => column.relation.targetColumnId === deletedCol.id || 
                               column.relation.displayColumnId === deletedCol.id
                );
                if (isReferencingDeletedColumn) {
                  return { ...column, relation: undefined };
                }
              }
              return column;
            });

            db.updateTable({
              id: refTableId,
              name: refTable.name,
              columns: updatedColumns
            }, (err) => {
              if (err) console.error('Error updating table with removed dict references:', err);
            });
          } catch (parseErr) {
            console.error('Error parsing columns for reference table:', refTableId, parseErr);
          }
        }
      });
    }

    const tableData = {
      id: tableId,
      name,
      columns
    };

    db.updateTable(tableData, (err) => {
      if (err) {
        console.error('Error updating table:', err);
        return res.status(500).json({ error: 'Failed to update table' });
      }

      const response = {
        message: 'Table updated successfully'
      };
      
      if (references.length > 0) {
        response.updatedReferences = references;
        response.note = '已自动移除对被删除列的字典子表引用';
      }
      
      res.json(response);
    });
  });
});

/**
 * @swagger
 * /tables/{tableId}:
 *   delete:
 *     summary: Delete a table
 *     parameters:
 *       - in: path
 *         name: tableId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Table deleted
 */
router.delete('/:tableId', (req, res) => {
  const { tableId } = req.params;
  const { confirmed = false } = req.query;

  db.getTables((err, allTables) => {
    if (err) {
      console.error('Error getting tables for reference check:', err);
      return res.status(500).json({ error: 'Failed to check references' });
    }

    const references = checkDictReferences(allTables, tableId);
    
    if (references.length > 0 && !confirmed) {
      return res.status(200).json({
        needsConfirmation: true,
        message: '此表格被其他表格引用为字典子表',
        references: references
      });
    }

    if (references.length > 0) {
      references.forEach(ref => {
        const refTable = allTables.find(t => t.id === ref.tableId);
        if (refTable) {
          const updatedColumns = (typeof refTable.columns === 'string' ? JSON.parse(refTable.columns) : refTable.columns).map(column => {
            if (column.dictRef === tableId) {
              return { ...column, dictRef: undefined };
            }
            return column;
          });

          db.updateTable({
            id: refTable.id,
            name: refTable.name,
            columns: updatedColumns
          }, (err) => {
            if (err) console.error('Error updating table with removed dict references:', err);
          });
        }
      });
    }

    db.deleteTable(tableId, (err) => {
      if (err) {
        console.error('Error deleting table:', err);
        return res.status(500).json({ error: 'Failed to delete table' });
      }

      res.json({ 
        message: 'Table deleted successfully',
        updatedReferences: references.length > 0 ? references : undefined,
        note: references.length > 0 ? '已自动移除对被删除表格的字典子表引用' : undefined
      });
    });
  });
});

module.exports = router;
