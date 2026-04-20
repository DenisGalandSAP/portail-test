import cds from '@sap/cds';

export default class CatalogService extends cds.ApplicationService {
    async init(): Promise<void> {
        // Initialize standard CAP logger (Routes to standard out -> Cloud Logging)
        const LOG = cds.log('catalog-service');

        // Connect to the BTP Audit Log Service
        const audit = await cds.connect.to('audit-log').catch(() => {
            console.warn("Audit Log service not bound natively, continuing as mock");
            return { emit: async () => { } };
        });

        this.on('UPDATE', 'Books', async (req: cds.Request) => {
            // ==========================================
            // 1. Context & Trace ID Extraction
            // ==========================================

            // Type casting headers to strings since they can technically be string[] in Node.js HTTP
            const traceparent = req.headers['traceparent'] as string | undefined;
            const correlationId = req.headers['x-correlation-id'] as string | undefined;

            // Extract Trace ID from W3C traceparent (Format: 00-[TraceId]-[SpanId]-01)
            const traceId = traceparent ? traceparent.split('-')[1] : (correlationId || 'no-trace-id');

            // Extract IP Address
            const ipAddress = (req.headers['x-forwarded-for'] as string) || (req.http?.req as any)?.ip || 'unknown-ip';

            // ==========================================
            // 2. Cloud Logging (Observability)
            // ==========================================

            LOG.info(`[TraceID: ${traceId}] Initiating Book update for user: ${req.user.id}`);

            try {
                // ... (Your actual database update logic would go here) ...

                // ==========================================
                // 3. Audit Logging (Security & Compliance)
                // ==========================================

                LOG.info(`[Audit Log] DataAccess event by user: ${req.user.id}, ip: ${ipAddress}, action: UPDATE_BOOK, id: ${req.data.ID}`);

                // Actual audit call (Must comply with BTP Audit Log V2 schema)
                await audit.emit('DataAccess', {
                    user: req.user.id,
                    tenant: req.tenant || 'provider',
                    ip: ipAddress,
                    object: {
                        type: 'Book',
                        id: { ID: req.data.ID }
                    },
                    data_subject: {
                        type: 'Book',
                        role: 'Updater',
                        id: { ID: req.data.ID }
                    },
                    data: req.data,
                    attributes: [
                        { name: "trace_id" },
                        { name: "action" }
                    ]
                });

                LOG.info(`[TraceID: ${traceId}] Book update completed successfully.`);

            } catch (err: unknown) {
                // In TypeScript, catch clause variables are 'unknown' by default
                const error = err as Error;

                LOG.error(`[TraceID: ${traceId}] Update failed: ${error.message}`);

                LOG.info(`[Audit Log] SecurityEvent error for Book ${req.data.ID} by user ${req.user.id}. trace_id: ${traceId}`);

                await audit.emit('SecurityEvent', {
                    user: req.user.id,
                    ip: ipAddress,
                    data: `Failed to update Book ${req.data.ID}`,
                    attributes: { trace_id: traceId, error: error.message }
                });

                throw error;
            }
        });

        this.before('READ', 'Books', async (req: cds.Request) => {
            // ==========================================
            // 1. Context & Trace ID Extraction
            // ==========================================

            const traceparent = req.headers['traceparent'] as string | undefined;
            const correlationId = req.headers['x-correlation-id'] as string | undefined;
            const traceId = traceparent ? traceparent.split('-')[1] : (correlationId || 'no-trace-id');
            const ipAddress = (req.headers['x-forwarded-for'] as string) || (req.http?.req as any)?.ip || 'unknown-ip';

            // ==========================================
            // 2. Cloud Logging (Observability)
            // ==========================================

            LOG.info(`[TraceID: ${traceId}] Initiating Book read for user: ${req.user.id}`);

            // ==========================================
            // 3. Audit Logging (Security & Compliance)
            // ==========================================

            const requestedId = req.data.ID ? `, id: ${req.data.ID}` : '';
            LOG.info(`[Audit Log] DataAccess event by user: ${req.user.id}, ip: ${ipAddress}, action: READ_BOOK, target: Books${requestedId}`);

            // Actual audit call (Must comply with BTP Audit Log V2 schema)
            await audit.emit('DataAccess', {
                user: req.user.id,
                tenant: req.tenant || 'provider',
                ip: ipAddress,
                object: {
                    type: 'Book',
                    id: { ID: req.data.ID || 'multiple' }
                },
                data_subject: {
                    type: 'Book',
                    role: 'Reader',
                    id: { ID: req.data.ID || 'multiple' }
                },
                data: req.query,
                attributes: [
                    { name: "trace_id", old: "", new: traceId },
                    { name: "action", old: "", new: "READ_BOOK_DETAILS" }
                ]
            });
        });

        // CRITICAL: Always call super.init() to ensure CAP registers the handlers properly
        return super.init();
    }
}