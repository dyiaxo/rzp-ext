import * as vscode from 'vscode';
import { Project, SyntaxKind, Node } from 'ts-morph';
import { SchemaRegistry, ApiSchema } from './schema';

const project = new Project({
  useInMemoryFileSystem: true
});

export class RazorpayLinter {
  private schemaRegistry: SchemaRegistry;

  constructor(schemaRegistry: SchemaRegistry) {
    this.schemaRegistry = schemaRegistry;
  }

  lintDocument(
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

      const apiCall = this.parseApiCall(node);
      if (!apiCall) return;

      const schema = this.schemaRegistry.findSchema(
        apiCall.resource,
        apiCall.method
      );
      
      if (!schema) return;

      const validationErrors = this.validateApiCall(
        node,
        apiCall.params,
        schema,
        document
      );

      diagnostics.push(...validationErrors);
    });

    diagnosticCollection.set(document.uri, diagnostics);
  }

  private parseApiCall(node: Node) {
    const expr = (node as any).getExpression();
    if (!Node.isPropertyAccessExpression(expr)) return null;

    const methodName = expr.getName();
    const left = expr.getExpression();
    
    if (!Node.isPropertyAccessExpression(left)) return null;

    const resourceName = left.getName();
    const args = (node as any).getArguments();
    
    if (args.length === 0) return null;

    const firstArg = args[0];
    if (!Node.isObjectLiteralExpression(firstArg)) return null;

    const passedParams = firstArg
      .getProperties()
      .filter(Node.isPropertyAssignment)
      .map(p => p.getName());

    return {
      resource: resourceName,
      method: methodName,
      params: passedParams,
      node: node
    };
  }

  private validateApiCall(
    node: Node,
    passedParams: string[],
    schema: ApiSchema,
    document: vscode.TextDocument
  ): vscode.Diagnostic[] {
    const diagnostics: vscode.Diagnostic[] = [];

    // Check required parameters
    schema.required.forEach(param => {
      if (!passedParams.includes(param)) {
        const range = new vscode.Range(
          document.positionAt(node.getStart()),
          document.positionAt(node.getEnd())
        );

        diagnostics.push(
          new vscode.Diagnostic(
            range,
            `Missing required parameter "${param}" in ${schema.api}`,
            vscode.DiagnosticSeverity.Error
          )
        );
      }
    });

    // TODO: Add type validation using schema.types
    // This would validate that amount is a number, currency is INR/USD, etc.

    return diagnostics;
  }
}
