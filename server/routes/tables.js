const express = require('express'); // 导入express模块
const router = express.Router();
const DatabaseWrapper = require('../db/database'); // 使用DatabaseWrapper类
const { v4: uuidv4 } = require('uuid');

const db = new DatabaseWrapper(); // 创建DatabaseWrapper实例

// 辅助函数：检测引用关系（包括字典子表和关联字段）
function checkDictReferences(allTables, targetTableId, targetColumnId = null) {
  const references = [];
  
  allTables.forEach(table => {
    try {
      // 确保table.columns是有效的字符串
      if (typeof table.columns !== 'string') {
        console.warn(`Table ${table.id} has invalid columns format`);
        return;
      }
      
      const columns = JSON.parse(table.columns);
      
      // 确保columns是数组
      if (!Array.isArray(columns)) {
        console.warn(`Table ${table.id} columns is not an array`);
        return;
      }
      
      columns.forEach(column => {
        // 确保column是对象
        if (!column || typeof column !== 'object') return;
        
        // 检查字典子表引用
        if (column.dictRef && 
            typeof column.dictRef === 'object' && 
            column.dictRef.tableId === targetTableId) {
              
          // 如果指定了列ID，则检查是否引用了该列
          if (targetColumnId) {
            // 只有当columnId存在且匹配时才加入引用列表
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
        
        // 检查关联字段引用
        if (column.relation && 
            typeof column.relation === 'object' && 
            column.relation.targetTableId === targetTableId) {
              
          // 如果指定了列ID，则检查是否引用了该列
          if (targetColumnId) {
            // 检查是否引用了该列作为targetColumnId或displayColumnId
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

// 獲取所有表格
router.get('/', (req, res) => {
  db.getTables((err, tables) => {
    if (err) {
      console.error('Error getting tables:', err);
      return res.status(500).json({ error: 'Failed to get tables' });
    }

    // 解析 columns JSON 字串
    const parsedTables = tables.map(table => ({
      ...table,
      columns: JSON.parse(table.columns)
    }));

    res.json(parsedTables);
  });
});

// 獲取單個表格（包含行數據）
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

    // 解析列信息
    const columns = JSON.parse(table.columns);
    
    // 获取所有表格以处理关联
    db.getTables((err, allTables) => {
      if (err) {
        console.error('Error getting all tables for relation processing:', err);
        return res.status(500).json({ error: 'Failed to process relations' });
      }

      // 獲取表格的行數據
      db.getTableRows(tableId, (err, rows) => {
        if (err) {
          console.error('Error getting rows:', err);
          return res.status(500).json({ error: 'Failed to get rows' });
        }

        // 解析數據
        const parsedRows = rows.map(row => JSON.parse(row.data));
        
        // 处理关联字段数据
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
            // 如果关联处理出错，仍然返回基础数据
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

// 处理关联字段数据的辅助函数
function processRelationFields(allTables, columns, rows) {
  return new Promise((resolve, reject) => {
    try {
      // 找出所有关联字段
      const relationColumns = columns.filter(col => col.relation && typeof col.relation === 'object');
      
      if (relationColumns.length === 0) {
        // 没有关联字段，直接返回
        return resolve(rows);
      }

      // 构建表格信息映射
      const tablesMap = {};
      allTables.forEach(table => {
        try {
          tablesMap[table.id] = {
            ...table,
            columns: JSON.parse(table.columns)
          };
        } catch (e) {
          console.warn(`Failed to parse columns for table ${table.id}`);
        }
      });

      // 获取所有需要的目标表数据
      const targetTableIds = new Set();
      relationColumns.forEach(col => {
        if (tablesMap[col.relation.targetTableId]) {
          targetTableIds.add(col.relation.targetTableId);
        }
      });

      // 如果没有有效的目标表，直接返回
      if (targetTableIds.size === 0) {
        return resolve(rows);
      }

      // 获取所有目标表的行数据
      const targetTablesData = {};
      let pendingQueries = targetTableIds.size;

      // 当所有查询完成时处理数据
      function handleAllDataFetched() {
        try {
          // 处理每行数据
          const processedRows = rows.map(row => {
            const processedRow = { ...row };
            
            // 处理每个关联字段
            relationColumns.forEach(col => {
              const relationData = col.relation;
              const targetTable = tablesMap[relationData.targetTableId];
              
              if (!targetTable || !targetTablesData[relationData.targetTableId]) {
                return; // 目标表不存在或数据未加载
              }
              
              const targetColumn = relationData.targetColumnId;
              const displayColumn = relationData.displayColumnId || targetColumn;
              const isMultiSelect = relationData.multiSelect;
              
              // 获取关联值
              const relationValue = row[col.id];
              
              if (!relationValue) {
                return; // 没有关联值
              }

              // 处理多选和单选
              if (isMultiSelect && Array.isArray(relationValue)) {
                // 多选模式
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
                // 单选模式
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

      // 获取每个目标表的数据
      targetTableIds.forEach(tableId => {
        db.getTableRows(tableId, (err, targetRows) => {
          pendingQueries--;
          
          if (!err && targetRows) {
            targetTablesData[tableId] = targetRows.map(row => {
              try {
                return JSON.parse(row.data);
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

// 創建新表格
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

// 更新表格結構
router.put('/:tableId', (req, res) => {
  const { tableId } = req.params;
  const { name, columns } = req.body;
  const { confirmed = false } = req.query; // 接收确认参数

  if (!name || !columns) {
    return res.status(400).json({ error: 'Name and columns are required' });
  }

  // 先获取所有表格以检查引用关系
  db.getTables((err, allTables) => {
    if (err) {
      console.error('Error getting tables for reference check:', err);
      return res.status(500).json({ error: 'Failed to check references' });
    }

    // 获取当前表格的旧结构
    const currentTable = allTables.find(t => t.id === tableId);
    if (!currentTable) {
      return res.status(404).json({ error: 'Table not found' });
    }

    const oldColumns = JSON.parse(currentTable.columns);
    const oldColumnIds = new Set(oldColumns.map(col => col.id));
    const newColumnIds = new Set(columns.map(col => col.id));
    
    // 找出被删除的列
    const deletedColumns = oldColumns.filter(col => !newColumnIds.has(col.id));
    
    // 检查是否有其他表格引用了被删除的列
    const references = [];
    deletedColumns.forEach(deletedCol => {
      // 确保传入正确的列ID用于精确检测引用
      const colReferences = checkDictReferences(allTables, tableId, deletedCol.id);
      if (colReferences.length > 0) {
        references.push({
          columnName: deletedCol.name,
          references: colReferences
        });
      }
    });

    // 如果有引用且未确认，返回引用信息，但不阻止更新
    if (references.length > 0 && !confirmed) {
      return res.status(200).json({
        needsConfirmation: true,
        message: '删除这些列将影响其他表格的字典子表设置',
        references: references
      });
    }

    // 如果有引用且已确认，需要自动更新这些引用（设置为undefined）
    if (references.length > 0) {
      // 需要更新的表格
      const tablesToUpdate = new Set();
      
      // 收集所有需要更新的表格ID
      references.forEach(refGroup => {
        refGroup.references.forEach(ref => {
          tablesToUpdate.add(ref.tableId);
        });
      });

      // 更新引用这些列的表格，移除无效的引用
      tablesToUpdate.forEach(refTableId => {
        const refTable = allTables.find(t => t.id === refTableId);
        if (refTable) {
          try {
            const refColumns = JSON.parse(refTable.columns);
            const updatedColumns = refColumns.map(column => {
              // 检查是否引用了被删除的列或表格
              
              // 先处理字典引用
              if (column.dictRef && typeof column.dictRef === 'object' && column.dictRef.tableId === tableId) {
                const isReferencingDeletedColumn = deletedColumns.some(
                  deletedCol => column.dictRef.columnId === deletedCol.id
                );
                if (isReferencingDeletedColumn) {
                  // 移除无效的字典引用
                  return {
                    ...column,
                    dictRef: undefined
                  };
                }
              }
              
              // 处理关联字段引用
              if (column.relation && typeof column.relation === 'object' && column.relation.targetTableId === tableId) {
                // 检查是否引用了被删除的列
                const isReferencingDeletedColumn = deletedColumns.some(
                  deletedCol => column.relation.targetColumnId === deletedCol.id || 
                               column.relation.displayColumnId === deletedCol.id
                );
                if (isReferencingDeletedColumn) {
                  // 移除无效的关联引用
                  return {
                    ...column,
                    relation: undefined
                  };
                }
              }
              
              return column;
            });

            // 保存更新后的表格结构
            db.updateTable({
              id: refTableId,
              name: refTable.name,
              columns: updatedColumns
            }, (err) => {
              if (err) {
                console.error('Error updating table with removed dict references:', err);
                // 这里不抛出错误，因为主更新操作仍需继续
              }
            });
          } catch (parseErr) {
            console.error('Error parsing columns for reference table:', refTableId, parseErr);
          }
        }
      });
    }

    // 准备更新当前表格
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

      // 无论是否有引用，都返回成功，并包含更新的引用信息（如果有）
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

// 刪除表格
router.delete('/:tableId', (req, res) => {
  const { tableId } = req.params;
  const { confirmed = false } = req.query; // 接收确认参数

  // 先获取所有表格以检查引用关系
  db.getTables((err, allTables) => {
    if (err) {
      console.error('Error getting tables for reference check:', err);
      return res.status(500).json({ error: 'Failed to check references' });
    }

    // 检查是否有其他表格引用了这个表格作为字典子表
    const references = checkDictReferences(allTables, tableId);
    
    if (references.length > 0 && !confirmed) {
      // 如果有引用且未确认，返回引用信息，但不阻止删除
      return res.status(200).json({
        needsConfirmation: true,
        message: '此表格被其他表格引用为字典子表',
        references: references
      });
    }

    // 处理删除表格和相关引用
    // 1. 先移除所有引用此表格的字典子表关联
    if (references.length > 0) {
      references.forEach(ref => {
        const refTable = allTables.find(t => t.id === ref.tableId);
        if (refTable) {
          const updatedColumns = refTable.columns.map(column => {
            // 移除引用了被删除表格的字典子表关联
            if (column.dictRef === tableId) {
              return {
                ...column,
                dictRef: undefined
              };
            }
            return column;
          });

          // 保存更新后的表格结构
          db.updateTable({
            id: refTable.id,
            name: refTable.name,
            columns: updatedColumns
          }, (err) => {
            if (err) {
              console.error('Error updating table with removed dict references:', err);
              // 这里不抛出错误，因为主删除操作仍需继续
            }
          });
        }
      });
    }

    // 2. 删除表格
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
