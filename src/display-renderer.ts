import './lib/tauri-api';
import './index.css';
import React from 'react';
import { createRoot } from "react-dom/client";
import { DisplayApp } from './DisplayApp';

const container = document.getElementById("root");
if (container) {
	const root = createRoot(container);
	root.render(React.createElement(DisplayApp));
}
