import { useState, useCallback } from "react"

export type LogLevel = "info" | "warn" | "error"

export interface LogEntry {
  id: number
  timestamp: Date
  level: LogLevel
  category: string
  message: string
}

const MAX_LOGS = 100
let logIdCounter = 0

export const useLogger = () => {
  const [logs, setLogs] = useState<LogEntry[]>([])

  const addLog = useCallback(
    (level: LogLevel, category: string, message: string) => {
      setLogs((prev) => {
        const entry: LogEntry = {
          id: logIdCounter++,
          timestamp: new Date(),
          level,
          category,
          message,
        }
        return [entry, ...prev].slice(0, MAX_LOGS)
      })
    },
    []
  )

  const clearLogs = useCallback(() => setLogs([]), [])

  return { logs, addLog, clearLogs }
}
