import { Window } from "happy-dom";

const window = new Window();

(globalThis as any).window = window;
(globalThis as any).document = window.document;
(globalThis as any).navigator = window.navigator;
(globalThis as any).HTMLElement = window.HTMLElement;
(globalThis as any).Text = window.Text;
(globalThis as any).Comment = window.Comment;
(globalThis as any).DocumentFragment = window.DocumentFragment;
(globalThis as any).MouseEvent = window.MouseEvent;
(globalThis as any).KeyboardEvent = window.KeyboardEvent;
(globalThis as any).FocusEvent = window.FocusEvent;
(globalThis as any).TouchEvent = window.TouchEvent;
(globalThis as any).WheelEvent = window.WheelEvent;
(globalThis as any).DragEvent = window.DragEvent;
(globalThis as any).Event = window.Event;
(globalThis as any).UIEvent = window.UIEvent;
(globalThis as any).InputEvent = window.InputEvent;
(globalThis as any).Touch = window.Touch;
(globalThis as any).DataTransfer = window.DataTransfer;
(globalThis as any).NodeList = window.NodeList;
(globalThis as any).HTMLCollection = window.HTMLCollection;
(globalThis as any).AbortController = window.AbortController;
(globalThis as any).requestAnimationFrame = window.requestAnimationFrame.bind(window);
(globalThis as any).cancelAnimationFrame = window.cancelAnimationFrame.bind(window);

(globalThis as any).__DEV__ = true;
