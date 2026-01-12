import * as fs from 'fs';
import * as path from 'path';

export interface ApiSchema {
    api: string;
    required: string[];
    types?: Record<string, string | string[]>;
    optional?: string[];
}

export class SchemaRegistry{
    private schemas: Map<string, ApiSchema> = new Map();

    constructor(schemaDir : string){
        this.loadSchemas(schemaDir);
    }
    private loadSchemas(schemaDir: string) {
        const files = fs.readdirSync(schemaDir);

        files.forEach(file => {
            if (!file.endsWith('.json')) return;

            const filePath = path.join(schemaDir, file);
            const content = fs.readFileSync(filePath, 'utf-8');
            const schema: ApiSchema = JSON.parse(content);
            
            // Store by API path: "orders.create", "payments.fetch", etc.
            this.schemas.set(schema.api, schema);
        });
    }

    getSchema(apiPath: string): ApiSchema | undefined {
        return this.schemas.get(apiPath);
    }

    getAllSchemas(): ApiSchema[] {
        return Array.from(this.schemas.values());
    }

    findSchema(resourceName: string, methodName: string): ApiSchema | undefined {
        const apiPath = `${resourceName}.${methodName}`;
        return this.schemas.get(apiPath);
    }

}