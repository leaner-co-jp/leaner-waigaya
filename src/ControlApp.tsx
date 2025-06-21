import React from "react"
import { SlackConnection } from "./components/SlackConnection"

export const ControlApp: React.FC = () => {
  return (
    <div className="min-h-screen bg-gray-100 py-8">
      <SlackConnection />
    </div>
  )
}
