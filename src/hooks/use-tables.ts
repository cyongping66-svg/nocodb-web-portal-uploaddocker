import { useState, useEffect } from 'react'
import { Table } from '@/types'
import { apiService } from '@/lib/api'
import { toast } from 'sonner'

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
      
      // 為每個表格獲取行數據
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
      // 這裡可以實現批量更新邏輯
      // 暫時先更新本地狀態
      toast.success('數據已更新')
    } catch (err) {
      console.error('Error syncing tables:', err)
      toast.error('同步到服務器時發生錯誤')
    }
  }

  const createTable = async (table: Omit<Table, 'rows'>) => {
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
    try {
      // 分離表格結構和行數據
      const { rows, ...tableStructure } = updatedTable
      
      // 更新表格結構
      await apiService.updateTable(updatedTable.id, tableStructure)
      
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
    try {
      await apiService.createRow(tableId, rowData)
      
      // 重新加載該表格的數據
      const rows = await apiService.getTableRows(tableId)
      setTablesState(prev => 
        prev.map(table => 
          table.id === tableId ? { ...table, rows } : table
        )
      )
      
      toast.success('數據已添加')
    } catch (err) {
      console.error('Error creating row:', err)
      toast.error('添加數據失敗')
    }
  }

  const updateRow = async (tableId: string, rowId: string, rowData: any) => {
    try {
      await apiService.updateRow(tableId, rowId, rowData)
      
      // 重新加載該表格的數據
      const rows = await apiService.getTableRows(tableId)
      setTablesState(prev => 
        prev.map(table => 
          table.id === tableId ? { ...table, rows } : table
        )
      )
      
      toast.success('數據已更新')
    } catch (err) {
      console.error('Error updating row:', err)
      toast.error('更新數據失敗')
    }
  }

  const deleteRow = async (tableId: string, rowId: string) => {
    try {
      await apiService.deleteRow(tableId, rowId)
      
      // 重新加載該表格的數據
      const rows = await apiService.getTableRows(tableId)
      setTablesState(prev => 
        prev.map(table => 
          table.id === tableId ? { ...table, rows } : table
        )
      )
      
      toast.success('數據已刪除')
    } catch (err) {
      console.error('Error deleting row:', err)
      toast.error('刪除數據失敗')
    }
  }

  const batchUpdateRows = async (tableId: string, operations: any[]) => {
    try {
      await apiService.batchUpdateRows(tableId, operations)
      
      // 重新加載該表格的數據
      const rows = await apiService.getTableRows(tableId)
      setTablesState(prev => 
        prev.map(table => 
          table.id === tableId ? { ...table, rows } : table
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
