import { neon } from '@neondatabase/serverless';
import { NextRequest, NextResponse } from 'next/server';

const sql = neon(process.env.DATABASE_URL || 'postgresql://user:password@localhost:5432/db');

function generateShareCode(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = 'AWR-';
  for (let i = 0; i < 4; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

export async function GET() {
  try {
    const wrappers = await sql`
      SELECT * FROM aw_wrappers 
      ORDER BY updated_at DESC 
      LIMIT 20
    `;
    
    return NextResponse.json(wrappers);
  } catch (error) {
    console.error('Error fetching wrappers:', error);
    return NextResponse.json(
      { error: 'Failed to fetch wrappers' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, base_url, auth_type, auth_config, endpoints, middleware } = body;
    
    if (!name || !base_url) {
      return NextResponse.json(
        { error: 'Name and base_url are required' },
        { status: 400 }
      );
    }
    
    let shareCode;
    let attempts = 0;
    const maxAttempts = 10;
    
    // Generate unique share code
    while (attempts < maxAttempts) {
      shareCode = generateShareCode();
      const existing = await sql`
        SELECT id FROM aw_wrappers WHERE share_code = ${shareCode}
      `;
      if (existing.length === 0) break;
      attempts++;
    }
    
    if (attempts === maxAttempts) {
      return NextResponse.json(
        { error: 'Failed to generate unique share code' },
        { status: 500 }
      );
    }
    
    const wrappers = await sql`
      INSERT INTO aw_wrappers (
        name, base_url, auth_type, auth_config, endpoints, middleware, share_code
      ) VALUES (
        ${name},
        ${base_url},
        ${auth_type || 'none'},
        ${JSON.stringify(auth_config || {})},
        ${JSON.stringify(endpoints || [])},
        ${JSON.stringify(middleware || {
          rateLimit: { enabled: false, requests: 100, windowMs: 60000 },
          cache: { enabled: false, ttlSeconds: 300 },
          retry: { enabled: true, attempts: 3, backoffMs: 1000 },
          timeout: { enabled: true, ms: 10000 }
        })},
        ${shareCode}
      )
      RETURNING *
    `;
    
    return NextResponse.json(wrappers[0]);
  } catch (error) {
    console.error('Error creating wrapper:', error);
    return NextResponse.json(
      { error: 'Failed to create wrapper' },
      { status: 500 }
    );
  }
}