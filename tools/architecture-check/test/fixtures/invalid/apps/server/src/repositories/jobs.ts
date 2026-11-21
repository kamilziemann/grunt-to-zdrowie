import { createDb } from '../infrastructure/db'; // layers: repositories -> infrastructure

export const createJobRepository = (): unknown => createDb();
