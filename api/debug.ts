export default async function handler(req: any, res: any) {
  const diagnostics: Record<string, any> = {};

  try {
    const exp = await import('express');
    diagnostics.express = typeof exp.default;
  } catch (e: any) {
    diagnostics.expressError = e.stack || e.message;
  }

  try {
    const bcr = await import('bcryptjs');
    diagnostics.bcrypt = typeof bcr.default;
  } catch (e: any) {
    diagnostics.bcryptError = e.stack || e.message;
  }

  try {
    const j = await import('jsonwebtoken');
    diagnostics.jwt = typeof j.default;
  } catch (e: any) {
    diagnostics.jwtError = e.stack || e.message;
  }

  try {
    const dbModule = await import('../server/db');
    diagnostics.db = typeof dbModule.db;
  } catch (e: any) {
    diagnostics.dbError = e.stack || e.message;
  }

  try {
    const serverModule = await import('../server/index');
    diagnostics.server = typeof serverModule.default;
  } catch (e: any) {
    diagnostics.serverError = e.stack || e.message;
  }

  res.status(200).json({ ok: true, diagnostics });
}
