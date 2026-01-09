import * as vscode from 'vscode';
import { Project, SyntaxKind, Node } from 'ts-morph';

const project = new Project({
    useInMemoryFileSystem: true
});

export function activate(context: vscode.ExtensionContext) {
	const diagnostic = vscode.languages.createDiagnosticCollection('razorpay-linter');
    
    context.subscriptions.push(diagnostic);

    vscode.workspace.onDidOpenTextDocument((document) => {
        lintDocument(document, diagnostic);
    });
    
    vscode.workspace.onDidChangeTextDocument((event) => {
        lintDocument(event.document, diagnostic);
    });
}

export function lintDocument(
  document: vscode.TextDocument,
  diagnosticCollection: vscode.DiagnosticCollection
) {
  if (!["javascript", "typescript"].includes(document.languageId)) return;

  const diagnostics: vscode.Diagnostic[] = [];
  const sourceFile = project.createSourceFile(
    document.fileName,
    document.getText(),
    { overwrite: true }
  );

  sourceFile.forEachDescendant(node => {
    if (!Node.isCallExpression(node)) return;

    const expr = node.getExpression();
    if (!Node.isPropertyAccessExpression(expr)) return;

    // expr === orders.create
    if (expr.getName() !== "create") return;

    const left = expr.getExpression();
    if (!Node.isPropertyAccessExpression(left)) return;

    if (left.getName() !== "orders") return;

    const args = node.getArguments();
    if (args.length === 0) return;

    const firstArg = args[0];
    if (!Node.isObjectLiteralExpression(firstArg)) return;

    const passedParams = firstArg
      .getProperties()
      .filter(Node.isPropertyAssignment)
      .map(p => p.getName());

    ["amount", "currency"].forEach(param => {
      if (!passedParams.includes(param)) {
        const range = new vscode.Range(
          document.positionAt(node.getStart()),
          document.positionAt(node.getEnd())
        );

        diagnostics.push(
          new vscode.Diagnostic(
            range,
            `Missing required parameter "${param}" in orders.create`,
            vscode.DiagnosticSeverity.Warning
          )
        );
      }
    });
  });

  diagnosticCollection.set(document.uri, diagnostics);
}

// This method is called when your extension is deactivated
export function deactivate() {}
