// ---------------------------------------------------------------------------
// OKrunit -- Tour Animation Engine
// ---------------------------------------------------------------------------
// Imperative controller that processes a sequence of animation commands
// (move cursor, click, type, select) to drive the real UI during tours.
// ---------------------------------------------------------------------------

// ---- Command Types --------------------------------------------------------

export type AnimationCommand =
  | { type: "move"; to: string }
  | { type: "click"; target: string }
  | { type: "type"; target: string; text: string; speed?: number }
  | { type: "clear"; target: string }
  | { type: "select-open"; trigger: string }
  | { type: "select-pick"; item: string }
  | { type: "wait"; ms: number }
  | { type: "scroll"; target: string; block?: ScrollLogicalPosition }
  | { type: "focus"; target: string }
  | { type: "tooltip-update"; text: string }
  | { type: "dialog-await"; selector?: string }
  | { type: "dialog-close" };

export interface AnimationConfig {
  commands: AnimationCommand[];
  autoAdvance?: boolean;
  pauseBetweenCommands?: number;
}

// ---- Engine Options -------------------------------------------------------

interface EngineCallbacks {
  onCursorMove: (x: number, y: number) => void;
  onCursorClick: () => void;
  onCursorClickEnd: () => void;
  onTooltipUpdate: (text: string) => void;
  onComplete: () => void;
}

// ---- Engine ---------------------------------------------------------------

export class TourAnimationEngine {
  private commands: AnimationCommand[];
  private pauseBetween: number;
  private callbacks: EngineCallbacks;
  private index = 0;
  private aborted = false;
  private timers: ReturnType<typeof setTimeout>[] = [];

  constructor(config: AnimationConfig, callbacks: EngineCallbacks) {
    this.commands = config.commands;
    this.pauseBetween = config.pauseBetweenCommands ?? 300;
    this.callbacks = callbacks;
  }

  start() {
    this.index = 0;
    this.aborted = false;
    this.processNext();
  }

  abort() {
    this.aborted = true;
    for (const t of this.timers) clearTimeout(t);
    this.timers = [];
    // Close any open dialogs
    const closeBtn = document.querySelector("[data-slot='dialog-close']") as HTMLElement | null;
    if (closeBtn) {
      closeBtn.click();
    } else {
      const dialogContent = document.querySelector("[data-slot='dialog-content']") as HTMLElement | null;
      if (dialogContent) {
        dialogContent.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true }));
      }
    }
  }

  get isRunning() {
    return !this.aborted && this.index < this.commands.length;
  }

  // ---------- Command Processing -------------------------------------------

  private processNext() {
    if (this.aborted || this.index >= this.commands.length) {
      if (!this.aborted) this.callbacks.onComplete();
      return;
    }

    const cmd = this.commands[this.index];
    this.index++;

    this.executeCommand(cmd).then(() => {
      if (this.aborted) return;
      const pause = cmd.type === "wait" ? 0 : this.pauseBetween;
      const t = setTimeout(() => this.processNext(), pause);
      this.timers.push(t);
    });
  }

  private async executeCommand(cmd: AnimationCommand): Promise<void> {
    switch (cmd.type) {
      case "move":
        return this.execMove(cmd.to);
      case "click":
        return this.execClick(cmd.target);
      case "type":
        return this.execType(cmd.target, cmd.text, cmd.speed);
      case "clear":
        return this.execClear(cmd.target);
      case "select-open":
        return this.execSelectOpen(cmd.trigger);
      case "select-pick":
        return this.execSelectPick(cmd.item);
      case "wait":
        return this.execWait(cmd.ms);
      case "scroll":
        return this.execScroll(cmd.target, cmd.block);
      case "focus":
        return this.execFocus(cmd.target);
      case "tooltip-update":
        this.callbacks.onTooltipUpdate(cmd.text);
        return;
      case "dialog-await":
        return this.execDialogAwait(cmd.selector);
      case "dialog-close":
        return this.execDialogClose();
    }
  }

  // ---------- Command Implementations --------------------------------------

  private execMove(selector: string): Promise<void> {
    return new Promise((resolve) => {
      const el = document.querySelector(selector);
      if (!el) {
        resolve();
        return;
      }
      const rect = el.getBoundingClientRect();
      const x = rect.left + rect.width / 2;
      const y = rect.top + rect.height / 2;
      this.callbacks.onCursorMove(x, y);
      // Wait for CSS transition (500ms) + buffer
      const t = setTimeout(resolve, 550);
      this.timers.push(t);
    });
  }

  private execClick(selector: string): Promise<void> {
    return new Promise((resolve) => {
      const el = document.querySelector(selector) as HTMLElement | null;
      if (!el) {
        resolve();
        return;
      }
      // Move to the element first
      const rect = el.getBoundingClientRect();
      this.callbacks.onCursorMove(rect.left + rect.width / 2, rect.top + rect.height / 2);

      const clickTimer = setTimeout(() => {
        if (this.aborted) return;
        this.callbacks.onCursorClick();
        // Dispatch full pointer event sequence for Radix compatibility
        el.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, cancelable: true }));
        el.dispatchEvent(new PointerEvent("pointerup", { bubbles: true, cancelable: true }));
        el.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));

        const endTimer = setTimeout(() => {
          this.callbacks.onCursorClickEnd();
          resolve();
        }, 200);
        this.timers.push(endTimer);
      }, 300);
      this.timers.push(clickTimer);
    });
  }

  private execType(selector: string, text: string, speed = 50): Promise<void> {
    return new Promise((resolve) => {
      const el = document.querySelector(selector) as HTMLInputElement | HTMLTextAreaElement | null;
      if (!el) {
        resolve();
        return;
      }
      el.focus();

      const isTextarea = el instanceof HTMLTextAreaElement;
      const nativeSetter = Object.getOwnPropertyDescriptor(
        isTextarea ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype,
        "value",
      )?.set;

      let i = 0;
      const typeChar = () => {
        if (this.aborted || i >= text.length) {
          resolve();
          return;
        }
        i++;
        const currentValue = text.slice(0, i);
        if (nativeSetter) {
          nativeSetter.call(el, currentValue);
        } else {
          el.value = currentValue;
        }
        el.dispatchEvent(new Event("input", { bubbles: true }));
        el.dispatchEvent(new Event("change", { bubbles: true }));

        // Randomize typing speed slightly for realism
        const delay = speed + Math.random() * 30 - 15;
        const t = setTimeout(typeChar, delay);
        this.timers.push(t);
      };

      typeChar();
    });
  }

  private execClear(selector: string): Promise<void> {
    return new Promise((resolve) => {
      const el = document.querySelector(selector) as HTMLInputElement | HTMLTextAreaElement | null;
      if (!el) {
        resolve();
        return;
      }
      const isTextarea = el instanceof HTMLTextAreaElement;
      const nativeSetter = Object.getOwnPropertyDescriptor(
        isTextarea ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype,
        "value",
      )?.set;

      if (nativeSetter) {
        nativeSetter.call(el, "");
      } else {
        el.value = "";
      }
      el.dispatchEvent(new Event("input", { bubbles: true }));
      el.dispatchEvent(new Event("change", { bubbles: true }));
      resolve();
    });
  }

  private execSelectOpen(selector: string): Promise<void> {
    return new Promise((resolve) => {
      const el = document.querySelector(selector) as HTMLElement | null;
      if (!el) {
        resolve();
        return;
      }
      // Move cursor to trigger
      const rect = el.getBoundingClientRect();
      this.callbacks.onCursorMove(rect.left + rect.width / 2, rect.top + rect.height / 2);

      const clickTimer = setTimeout(() => {
        if (this.aborted) return;
        this.callbacks.onCursorClick();
        el.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, cancelable: true }));
        el.dispatchEvent(new PointerEvent("pointerup", { bubbles: true, cancelable: true }));
        el.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));

        const endTimer = setTimeout(() => {
          this.callbacks.onCursorClickEnd();
          resolve();
        }, 300);
        this.timers.push(endTimer);
      }, 300);
      this.timers.push(clickTimer);
    });
  }

  private execSelectPick(selector: string): Promise<void> {
    return new Promise((resolve) => {
      // Poll for the select item to appear (it's in a portal)
      let attempts = 0;
      const find = () => {
        if (this.aborted) {
          resolve();
          return;
        }
        const el = document.querySelector(selector) as HTMLElement | null;
        if (el) {
          const rect = el.getBoundingClientRect();
          this.callbacks.onCursorMove(rect.left + rect.width / 2, rect.top + rect.height / 2);

          const clickTimer = setTimeout(() => {
            if (this.aborted) return;
            this.callbacks.onCursorClick();
            el.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, cancelable: true }));
            el.dispatchEvent(new PointerEvent("pointerup", { bubbles: true, cancelable: true }));
            el.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));

            const endTimer = setTimeout(() => {
              this.callbacks.onCursorClickEnd();
              resolve();
            }, 200);
            this.timers.push(endTimer);
          }, 400);
          this.timers.push(clickTimer);
          return;
        }
        attempts++;
        if (attempts < 40) {
          const t = setTimeout(find, 50);
          this.timers.push(t);
        } else {
          resolve();
        }
      };
      find();
    });
  }

  private execWait(ms: number): Promise<void> {
    return new Promise((resolve) => {
      const t = setTimeout(resolve, ms);
      this.timers.push(t);
    });
  }

  private execScroll(selector: string, block?: ScrollLogicalPosition): Promise<void> {
    return new Promise((resolve) => {
      const el = document.querySelector(selector);
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: block ?? "center" });
      }
      const t = setTimeout(resolve, 500);
      this.timers.push(t);
    });
  }

  private execFocus(selector: string): Promise<void> {
    return new Promise((resolve) => {
      const el = document.querySelector(selector) as HTMLElement | null;
      if (el) el.focus();
      resolve();
    });
  }

  private execDialogAwait(selector?: string): Promise<void> {
    return new Promise((resolve) => {
      const sel = selector ?? "[data-slot='dialog-content']";
      let attempts = 0;
      const check = () => {
        if (this.aborted) {
          resolve();
          return;
        }
        if (document.querySelector(sel)) {
          // Wait a beat for enter animation
          const t = setTimeout(resolve, 400);
          this.timers.push(t);
          return;
        }
        attempts++;
        if (attempts < 40) {
          const t = setTimeout(check, 50);
          this.timers.push(t);
        } else {
          resolve();
        }
      };
      check();
    });
  }

  private execDialogClose(): Promise<void> {
    return new Promise((resolve) => {
      // Try clicking the Radix close button first (most reliable)
      const closeBtn = document.querySelector("[data-slot='dialog-close']") as HTMLElement | null;
      if (closeBtn) {
        closeBtn.click();
      } else {
        // Fallback: press Escape on the dialog content (Radix listens there)
        const dialogContent = document.querySelector("[data-slot='dialog-content']") as HTMLElement | null;
        const target = dialogContent ?? document.body;
        target.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true }));
      }
      const t = setTimeout(resolve, 400);
      this.timers.push(t);
    });
  }
}
