// ABOUTME: Desktop entry point — delegates immediately to lib::run().
// ABOUTME: Keeps main.rs minimal per Tauri v2 convention.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    niko_lib::run()
}
