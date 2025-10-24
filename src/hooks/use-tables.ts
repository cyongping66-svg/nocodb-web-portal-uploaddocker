import { useState, useEffect } from 'react'
import { Table } from '@/types'
import { apiService } from '@/lib/api'
import { toast } from 'sonner'

// 移除瀏覽器本地存儲的行順序工具，改為後端持久化
const ROW_ORDER_KEY_PREFIX = 'tableRowOrder:'
const getLocalRowOrder = (tableId: string): string[] => {
  try {
    const raw = localStorage.getItem(`${ROW_ORDER_KEY_PREFIX}${tableId}`)
    if (!raw) return []
    const ids = JSON.parse(raw)
    return Array.isArray(ids) ? ids : []
  } catch {
    return []
  }
}
const setLocalRowOrder = (tableId: string, orderIds: string[]) => {
  try {
    localStorage.setItem(`${ROW_ORDER_KEY_PREFIX}${tableId}`, JSON.stringify(orderIds))
  } catch (e) {
    console.warn('保存行順序到本地失敗', e)
  }
}
const applyRowOrder = (rows: any[], orderIds: string[]) => {
  if (!orderIds || orderIds.length === 0) return rows
  const idToRow = new Map(rows.map(r => [r.id, r]))
  const ordered: any[] = []
  for (const id of orderIds) {
    const row = idToRow.get(id)
    if (row) {
      ordered.push(row)
      idToRow.delete(id)
    }
  }
  for (const r of rows) {
    if (idToRow.has(r.id)) {
      ordered.push(r)
      idToRow.delete(r.id)
    }
  }
  return ordered
}

export function useTables() {
  const [tables, setTablesState] = useState<Table[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // 初始化加載數據
  useEffect(() => {
    loadTables()
  }, [])

  const loadTables = async () => {
    setLoading(true)
    setError(null)

    try {
      // 獲取所有表格
      const tablesData = await apiService.getTables()
      
      // 為每個表格獲取行數據（已由後端按 row_orders 排序）
      const tablesWithRows = await Promise.all(
        tablesData.map(async (table: any) => {
          try {
            const rows = await apiService.getTableRows(table.id)
            return {
              ...table,
              rows: rows || []
            }
          } catch (err) {
            console.error(`Error loading table ${table.id}:`, err)
            return { ...table, rows: [] }
          }
        })
      )
      
      setTablesState(tablesWithRows)
    } catch (err) {
      console.error('Error loading tables:', err)
      setError('載入資料時發生錯誤')
      toast.error('無法連接到服務器')
    } finally {
      setLoading(false)
    }
  }

  const setTables = async (newTables: Table[] | ((prev: Table[]) => Table[])) => {
    const updatedTables = typeof newTables === 'function' ? newTables(tables) : newTables
    
    // 立即更新本地狀態
    setTablesState(updatedTables)
    
    try {
      toast.success('數據已更新')
    } catch (err) {
      console.error('Error syncing tables:', err)
      toast.error('同步到服務器時發生錯誤')
    }
  }

  const createTable = async (table: Omit<Table, 'rows'>) => {
    if (!isAuthenticated()) {
      toast.error('未登入，禁止新增表格');
      throw new Error('NOT_AUTHENTICATED');
    }
    try {
      const result = await apiService.createTable(table)
      const newTable: Table = { ...table, rows: [] }
      setTablesState(prev => [...prev, newTable])
      toast.success('表格已創建')
    } catch (err) {
      console.error('Error creating table:', err)
      toast.error('創建表格失敗')
    }
  }

  const deleteTable = async (tableId: string) => {
    if (!isAuthenticated()) {
      toast.error('未登入，禁止刪除表格');
      throw new Error('NOT_AUTHENTICATED');
    }
    try {
      await apiService.deleteTable(tableId)
      setTablesState(prev => prev.filter(t => t.id !== tableId))
      toast.success('表格已刪除')
    } catch (err) {
      console.error('Error deleting table:', err)
      toast.error('刪除表格失敗')
    }
  }

  const updateTable = async (updatedTable: Table) => {
    if (!isAuthenticated()) {
      toast.error('未登入，禁止更新表格');
      throw new Error('NOT_AUTHENTICATED');
    }
    try {
      // 分離表格結構和行數據
      const { rows, ...tableStructure } = updatedTable
      
      // 更新表格結構
      await apiService.updateTable(updatedTable.id, tableStructure)
      
      // 新增：持久化保存行順序（若有行數據）改用後端API
      if (updatedTable.rows && Array.isArray(updatedTable.rows)) {
        const orderIds = updatedTable.rows.map(r => r.id)
        await apiService.setRowOrder(updatedTable.id, orderIds)
      }
      
      // 更新本地狀態
      setTablesState(prev => 
        prev.map(table => 
          table.id === updatedTable.id ? updatedTable : table
        )
      )
    } catch (err) {
      console.error('Error updating table:', err)
      toast.error('更新表格失敗')
    }
  }

  const refresh = () => {
    loadTables()
  }

  // 行數據操作方法
  const createRow = async (tableId: string, rowData: any) => {
    if (!isAuthenticated()) {
      toast.error('未登入，禁止新增行');
      throw new Error('NOT_AUTHENTICATED');
    }
    try {
      // 确保有唯一的ID
      if (!rowData.id) {
        rowData.id = `row_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      }
      
      // 调用API创建新行
      await apiService.createRow(tableId, rowData)
      
      // 重新加載該表格的數據（後端已按 row_orders 排序，未設置的追加末尾）
      const rows = await apiService.getTableRows(tableId)
      setTablesState(prev => 
        prev.map(table => 
          table.id === tableId ? { ...table, rows: rows || [] } : table
        )
      )
      
      return { success: true, rowId: rowData.id } // 返回成功标志和行ID
    } catch (err) {
      console.error('Error creating row:', err)
      toast.error('添加數據失敗')
      throw err; // 抛出错误以便上层组件处理
    }
  }

  const updateRow = async (tableId: string, rowId: string, rowData: any) => {
    if (!isAuthenticated()) {
      toast.error('未登入，禁止更新行');
      throw new Error('NOT_AUTHENTICATED');
    }
    try {
      // 首先获取当前行数据
      const table = tables.find(t => t.id === tableId);
      const currentRow = table?.rows.find(row => row.id === rowId);
      
      // 如果找到当前行，合并现有数据和新数据
      const updatedRowData = currentRow 
        ? { ...currentRow, ...rowData }
        : rowData;
      
      // 确保id一致
      updatedRowData.id = rowId;
      
      // 调用API更新数据
      await apiService.updateRow(tableId, rowId, updatedRowData)
      
      // 重新加載該表格的數據（後端已按 row_orders 排序）
      const rows = await apiService.getTableRows(tableId)
      setTablesState(prev => 
        prev.map(table => 
          table.id === tableId ? { ...table, rows: rows || [] } : table
        )
      )
      
      return { success: true } // 返回成功标志
    } catch (err) {
      console.error('Error updating row:', err)
      toast.error('更新數據失敗')
      throw err; // 抛出错误以便上层组件处理
    }
  }

  const deleteRow = async (tableId: string, rowId: string) => {
    if (!isAuthenticated()) {
      toast.error('未登入，禁止刪除行');
      throw new Error('NOT_AUTHENTICATED');
    }
    try {
      // 调用API删除行
      await apiService.deleteRow(tableId, rowId)
      
      // 重新加載該表格的數據（後端已按 row_orders 排序）
      const rows = await apiService.getTableRows(tableId)
      setTablesState(prev => 
        prev.map(table => 
          table.id === tableId ? { ...table, rows: rows || [] } : table
        )
      )
      
      toast.success('數據已刪除')
      return { success: true } // 返回成功标志
    } catch (err) {
      console.error('Error deleting row:', err)
      toast.error('刪除數據失敗')
      throw err; // 抛出错误以便上层组件处理
    }
  }

  const batchUpdateRows = async (tableId: string, operations: any[]) => {
    if (!isAuthenticated()) {
      toast.error('未登入，禁止批量操作');
      throw new Error('NOT_AUTHENTICATED');
    }
    try {
      await apiService.batchUpdateRows(tableId, operations)
      
      // 重新加載該表格的數據（後端已按 row_orders 排序）
      const rows = await apiService.getTableRows(tableId)
      setTablesState(prev => 
        prev.map(table => 
          table.id === tableId ? { ...table, rows: rows || [] } : table
        )
      )
      
      toast.success('批量操作已完成')
    } catch (err) {
      console.error('Error batch updating rows:', err)
      toast.error('批量操作失敗')
    }
  }

  return {
    tables,
    setTables,
    createTable,
    deleteTable,
    updateTable,
    createRow,
    updateRow,
    deleteRow,
    batchUpdateRows,
    loading,
    error,
    refresh
  }
}

const isAuthenticated = () => !!(localStorage.getItem('currentUserName') || localStorage.getItem('foundation_user_name'));
