// A saved starting template for the editor, LeetCode-style: the boilerplate a
// student wants every new editor to open with (fast I/O, macros, helper
// functions, whatever they always type) instead of the built-in stub.
//
// Kept in this browser's local storage - it is a personal editor preference,
// not contest data, so it deliberately does not sync to the server and is
// shared across every problem and the standalone compiler on this laptop.
const STORAGE_KEY = "contest_code_template";

export const DEFAULT_TEMPLATE = `#include <iostream>
using namespace std;

int main() {
    // Write your code here
    return 0;
}`;

export function getTemplate(): string {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved && saved.trim() ? saved : DEFAULT_TEMPLATE;
  } catch {
    return DEFAULT_TEMPLATE;
  }
}

export function hasCustomTemplate(): boolean {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return !!(saved && saved.trim());
  } catch {
    return false;
  }
}

export function saveTemplate(code: string): void {
  try {
    localStorage.setItem(STORAGE_KEY, code);
  } catch {
    /* private mode / storage full - the in-memory editor still works */
  }
}

export function resetTemplate(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* nothing to undo if the write never landed */
  }
}
