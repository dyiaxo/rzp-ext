import * as vscode from 'vscode';
import * as path from 'path';
import { SchemaRegistry } from '../core/schema';
import { RazorpayLinter } from '../core/linter';

let registry : SchemaRegistry | undefined;
let linter : RazorpayLinter | undefined;

function getLinter(ctx : vscode.ExtensionContext){
  if(!registry){
    const schemaDir = path.join(ctx.extensionPath, 'schemas');
    registry = new SchemaRegistry(schemaDir);
    linter = new RazorpayLinter(registry);
  }
  return linter;
}

export function activate(context: vscode.ExtensionContext) {
  // Load schemas from the schemas directory
  const schemaDir = path.join(context.extensionPath, 'schemas');
  const schemaRegistry = new SchemaRegistry(schemaDir);

  const linter = new RazorpayLinter(schemaRegistry);
  const diagnostic = vscode.languages.createDiagnosticCollection('razorpay-linter');

  context.subscriptions.push(diagnostic);
  const lintQueue = new Map<string, NodeJS.Timeout>();

  function scheduleLint(doc: vscode.TextDocument) {
    // Only lint JavaScript/TypeScript files
    if (!['javascript', 'typescript', 'javascriptreact', 'typescriptreact'].includes(doc.languageId)) {
      return;
    }

    // Skip non-file schemes (output, git, etc.)
    if (doc.uri.scheme !== 'file') {
      return;
    }

    const key = doc.uri.toString();
    const existing = lintQueue.get(key);
    if (existing) {
      clearTimeout(existing);
    }
    
    const timeout = setTimeout(() => {
      linter.lintDocument(doc, diagnostic);
      lintQueue.delete(key);
    }, 300);
    
    lintQueue.set(key, timeout);
  }
  
  context.subscriptions.push(
    vscode.workspace.onDidOpenTextDocument(scheduleLint),
    vscode.workspace.onDidChangeTextDocument(e => scheduleLint(e.document))
  );

  setTimeout(() => {
    vscode.workspace.textDocuments.forEach(scheduleLint);
  }, 1000);

  console.log(`Loaded ${schemaRegistry.getAllSchemas().length} Razorpay API schemas`);
}

export function deactivate() { }