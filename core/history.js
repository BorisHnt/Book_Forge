export class CommandHistory {
  constructor(limit = 120) {
    this.limit = limit;
    this.undoStack = [];
    this.redoStack = [];
  }

  push(command) {
    this.undoStack.push(command);
    if (this.undoStack.length > this.limit) {
      this.undoStack.shift();
    }
    this.redoStack = [];
  }

  undo() {
    const command = this.undoStack.pop();
    if (!command) {
      return null;
    }
    command.undo();
    this.redoStack.push(command);
    return command;
  }

  redo() {
    const command = this.redoStack.pop();
    if (!command) {
      return null;
    }
    command.redo();
    this.undoStack.push(command);
    return command;
  }

  canUndo() {
    return this.undoStack.length > 0;
  }

  canRedo() {
    return this.redoStack.length > 0;
  }
}
