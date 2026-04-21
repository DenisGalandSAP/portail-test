import cds from '@sap/cds';

export default class CatalogService extends cds.ApplicationService {
    async init(): Promise<void> {
        // Initialize standard CAP logger for general application observability
        const LOG = cds.log('catalog-service');

        // Connect to the BTP Audit Log Service
        // We use a `.catch()` fallback to return a mock emitter so the app 
        // doesn't crash during local development when the service isn't bound.
        const audit = await cds.connect.to('audit-log').catch(() => {
            console.warn("Audit Log service not bound natively, continuing as mock");
            return { emit: async () => { } };
        });

        // ====================================================================
        // UPDATE HANDLER (Data Modification Logging)
        // ====================================================================
        this.on('UPDATE', 'Books', async (req: cds.Request) => {
            try {
                // ... (Your actual database update logic would go here) ...

                // ---------------------------------------------------------
                // AUDIT LOG: DataAccess (Success)
                // ---------------------------------------------------------
                // We emit a 'DataAccess' event to record that a user modified data.
                // Note: The CAP outbox handles this automatically if the transaction succeeds.
                await audit.emit('DataAccess', {
                    user: req.user.id,
                    tenant: req.tenant || 'provider', // Defaults to 'provider' for single-tenant
                    object: {
                        type: 'Book',
                        id: { ID: req.data.ID }
                    },
                    data_subject: {
                        type: 'Book',
                        role: 'Updater', // Clarifies the user's role in this specific action
                        id: { ID: req.data.ID }
                    }
                });

            } catch (err: unknown) {
                const error = err as Error;
                LOG.error(`Update failed: ${error.message}`);

                // Extract IP specifically for the SecurityEvent (which supports it)
                const ipAddress = (req.headers['x-forwarded-for'] as string) || (req.http?.req as any)?.ip || 'unknown-ip';

                // ---------------------------------------------------------
                // AUDIT LOG: SecurityEvent (Failure/Unauthorized)
                // ---------------------------------------------------------
                // If a destructive or unauthorized action fails, log a SecurityEvent.
                // CRITICAL: We use `cds.unboxed(audit)` here. Because an error is thrown,
                // the CAP database transaction rolls back. If we didn't unbox it, the 
                // audit log event sitting in the outbox would be rolled back and lost too.
                await (cds as any).unboxed(audit).emit('SecurityEvent', {
                    user: req.user.id,
                    ip: ipAddress,
                    data: `Failed to update Book ${req.data.ID}. Error: ${error.message}`
                });

                throw error; // Re-throw to ensure the user gets an error response
            }
        });

        // ====================================================================
        // READ HANDLER (Data Read Logging)
        // ====================================================================
        this.before('READ', 'Books', async (req: cds.Request) => {
            // ---------------------------------------------------------
            // AUDIT LOG: DataAccess (Read)
            // ---------------------------------------------------------
            // Emitted BEFORE the read to capture who is attempting to access the data.
            // CRITICAL: We use `cds.unboxed(audit)` because READ requests do not 
            // generate database commits, meaning the standard CAP transactional 
            // outbox is never triggered to flush the logs.
            await (cds as any).unboxed(audit).emit('DataAccess', {
                user: req.user.id,
                tenant: req.tenant || 'provider',
                object: {
                    type: 'Book',
                    // Handle lists: req.data.ID is undefined if reading all books
                    id: { ID: req.data.ID || 'multiple' }
                },
                data_subject: {
                    type: 'Book',
                    role: 'Reader',
                    id: { ID: req.data.ID || 'multiple' }
                }
            });
        });

        // CRITICAL: Always call super.init() so CAP registers these custom handlers properly
        return super.init();
    }
}
