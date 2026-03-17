# Sebooth - AI Agent Guidelines

Welcome AI Agent! This file (`agents.md`) provides critical context, architecture details, and development conventions for the **Sebooth** project. Please read and follow these guidelines when modifying or creating code in this repository.

## 1. Project Overview
**Sebooth** is a high-end desktop photobooth application built with Electron and React.
Key features include:
- **DSLR/Mirrorless Camera Integration** via `digiCamControl` (PTP communication).
- **Silent Printing** directly to connected printers without UI dialogs.
- **Media Processing** for photos (PNG overlays, LUT filters), boomerangs, and GIFs.
- **Cloud Storage & Logging** via Supabase.

## 2. Technology Stack
- **Core**: Electron, React 18, Vite.
- **Language**: TypeScript (Strict typing preferred).
- **State Management**: Zustand.
- **Routing**: React Router DOM.
- **Media & Image Processing**: 
  - `fluent-ffmpeg` / `@ffmpeg-installer/ffmpeg` (Video processing)
  - `sharp` (Image manipulation)
  - `gifenc` (GIF encoding)
- **Hardware & Peripherals**: 
  - `pdf-to-printer` (Printing)
  - `usb` (Device detection)
- **Backend/Cloud**: Supabase (`@supabase/supabase-js`).

## 3. Project Architecture
The `src/` directory is split into the standard secure Electron architecture:

- **`src/main/`**: Electron Main Process. Handles native machine resources, hardware integrations (cameras, printers), database connections, and heavy media processing (FFmpeg, Sharp).
- **`src/preload/`**: Context Bridge. Safely exposes scoped IPC communication methods from the main process to the renderer process.
- **`src/renderer/`**: React Frontend. Handles the UI, state, camera live view, and user interactions. 
- **`src/shared/`**: Shared types and constants used across both Main and Renderer processes to ensure type safety for IPC calls.

## 4. Development Rules & Conventions

### IPC Communication (Crucial)
- **DO NOT** expose raw `ipcRenderer` or Node.js built-ins directly to the React frontend.
- **ALWAYS** define IPC channels and payload types in `src/shared/`.
- Register the handlers in `src/main/` and expose them to the frontend strictly through `src/preload/`.

### Performance & Threading
- **Heavy Processing in Main**: Any CPU-intensive task (like applying LUT filters via Sharp, generating PDFs, or running FFmpeg commands) MUST happen in the `main` process to prevent freezing the React UI.
- **Asynchronous Operations**: Use `async/await` and Promises for all file system, database, and hardware tasks. Avoid synchronous Node.js APIs (`fs.readFileSync`, etc.) whenever possible.

### Error Handling & Hardware
- **Hardware Stability**: Interacting with physical devices (cameras, printers, USB) is prone to edge cases (e.g., unplugged devices, paper jams). Implement robust `try-catch` blocks and return structured error messages back to the renderer process.
- **Logging**: Ensure backend errors are logged and safely communicated to the frontend so the user knows what went wrong without crashing the application.

### Frontend Development
- **State**: Use Zustand for global state management. Keep stores modular.
- **React Standards**: Use functional components and modern hooks. Keep pure UI components separate from logic-heavy container components if necessary.

## 5. Scripts and Environments
- **Development**: `npm run dev` (Starts Vite dev server + Electron).
- **Build**: `npm run build` (Compiles TS + Vite build process).
- **Packager**: `npm run build:win`, `npm run build:mac`, `npm run build:linux` (Uses electron-builder to generate installers in the `dist/` folder).

---
*Note to AI Agent: Always verify the current state of files using codebase search before making sweeping changes, as there are custom scripts (like `patch-uri.js`, `pdf-patch.js`) and tests (`test-ffmpeg-*.js`) that might rely on specific internal behaviors.*
