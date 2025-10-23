import {OpenAPIV3} from "openapi-types";
import {OpenAPIVisitor} from "./OpenAPIVisitor";

const HttpMethods: string[] = Object.values(OpenAPIV3.HttpMethods);

export class OpenAPIWalker {
    private readonly doc: OpenAPIV3.Document

    constructor(doc: any) {
        this.doc = doc;

    }

    walk(visitor: OpenAPIVisitor) {
        this.walkDocument(visitor);
        this.walkPaths(visitor);
        this.walkTags(visitor);
        if (visitor.finish) {
            visitor.finish();
        }
    }

    private walkDocument(visitor: OpenAPIVisitor, doc?: OpenAPIV3.Document) {
        if (!doc) {
            doc = this.doc;
        }
        if (visitor.visitDocument) {
            visitor.visitDocument(doc)
        }
    }

    private walkPaths(visitor: OpenAPIVisitor, paths?: OpenAPIV3.PathsObject) {
        if (!paths) {
            paths = this.doc.paths;
        }
        if (!paths) {
            return;
        }
        for (const path in paths) {
            const pathItem: OpenAPIV3.PathItemObject = paths[path] as OpenAPIV3.PathItemObject;
            // Extract path-level parameters
            const pathLevelParameters = pathItem.parameters || [];
            
            let method: string;
            let operation: any;
            for ([method, operation] of Object.entries(pathItem)) {
                if (!HttpMethods.includes(method)) {
                    continue;
                }
                if (!operation.tags || operation.tags.length === 0) {
                    operation.tags = ['default']
                }
                if (operation && visitor.visitOperation) {
                    // Merge path-level parameters with operation-level parameters
                    // Operation-level parameters override path-level ones with the same name
                    if (pathLevelParameters.length > 0) {
                        const operationParameters = operation.parameters || [];
                        
                        // Create a map of operation parameter names for quick lookup
                        const operationParamNames = new Set(
                            operationParameters.map((p: any) => {
                                // Handle both ReferenceObject and ParameterObject
                                if ('$ref' in p) {
                                    return null; // Will be resolved later
                                }
                                return p.name;
                            }).filter(Boolean)
                        );
                        
                        // Add path-level parameters that are not overridden by operation-level ones
                        const mergedParameters = [
                            ...pathLevelParameters.filter((p) => {
                                if ('$ref' in p) {
                                    return true; // Include references, they'll be resolved later
                                }
                                return !operationParamNames.has(p.name);
                            }),
                            ...operationParameters
                        ];
                        
                        operation.parameters = mergedParameters;
                    }
                    
                    const context = {pattern: path, path: pathItem, method: method as OpenAPIV3.HttpMethods};
                    visitor.visitOperation(operation, context);
                }
            }
        }
    }

    private walkTags(visitor: OpenAPIVisitor, tags?: OpenAPIV3.TagObject[]) {
        if (!tags) {
            tags = this.doc.tags;
        }
        if (!tags) {
            return;
        }
        if (!visitor.visitTag) {
            return;
        }
        for (const tag of tags) {
            visitor.visitTag(tag);
        }
    }
}
