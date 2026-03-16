import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { dirname } from "path";

/**
 * Ensure a directory exists, creating it recursively if needed
 * @param {string} dirPath - Path to directory
 */
export function ensureDir(dirPath: string): void {
  if (!existsSync(dirPath)) {
    mkdirSync(dirPath, { recursive: true });
  }
}

/**
 * Write a file, creating parent directories if needed
 * @param {string} filePath - Path to file
 * @param {string} content - File content
 */
export function writeFileSafe(filePath: string, content: string): void {
  ensureDir(dirname(filePath));
  writeFileSync(filePath, content, "utf-8");
}

/**
 * Read a file as a UTF-8 string
 * @param {string} filePath - Path to file
 * @returns {string} File content
 */
export function readFileSafe(filePath: string): string {
  return readFileSync(filePath, "utf-8");
}

/**
 * Check if a file exists
 * @param {string} filePath - Path to file
 * @returns {boolean} Whether the file exists
 */
export function fileExists(filePath: string): boolean {
  return existsSync(filePath);
}
