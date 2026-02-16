import './lib/tauri-api';
import './index.css';
import React from 'react';
import { createRoot } from "react-dom/client";
import { ControlApp } from './ControlApp';

const container = document.getElementById("root");
if (container) {
	const root = createRoot(container);
	root.render(React.createElement(ControlApp));
}
