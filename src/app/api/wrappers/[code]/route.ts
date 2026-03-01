import { neon } from '@neondatabase/serverless';
import { NextRequest, NextResponse } from 'next/server';

const sql = neon(process.env.DATABASE_URL || 'postgresql://user:password@localhost:5432/db');

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  try {
    const { code } = await params;
    
    const wrappers = await sql`
      SELECT * FROM aw_wrappers 
      WHERE share_code = ${code}
    `;
    
    if (wrappers.length === 0) {
      return NextResponse.json(
        { error: 'Wrapper not found' },
        { status: 404 }
      );
    }
    
    return NextResponse.json(wrappers[0]);
  } catch (error) {
    console.error('Error fetching wrapper:', error);
    return NextResponse.json(
      { error: 'Failed to fetch wrapper' },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  try {
    const { code } = await params;
    const body = await request.json();
    
    // Build update object dynamically
    const allowedFields = ['name', 'base_url', 'auth_type', 'auth_config', 'endpoints', 'middleware'];
    const updates: any = {};
    
    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updates[field] = body[field];
      }
    }
    
    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        { error: 'No valid fields to update' },
        { status: 400 }
      );
    }
    
    // Use direct SQL with template literals
    let query = 'UPDATE aw_wrappers SET ';
    const setParts: string[] = [];
    
    if (updates.name) setParts.push(`name = '${updates.name.replace(/'/g, "''")}'`);
    if (updates.base_url) setParts.push(`base_url = '${updates.base_url.replace(/'/g, "''")}'`);
    if (updates.auth_type) setParts.push(`auth_type = '${updates.auth_type}'`);
    if (updates.auth_config) setParts.push(`auth_config = '${JSON.stringify(updates.auth_config).replace(/'/g, "''")}'::jsonb`);
    if (updates.endpoints) setParts.push(`endpoints = '${JSON.stringify(updates.endpoints).replace(/'/g, "''")}'::jsonb`);
    if (updates.middleware) setParts.push(`middleware = '${JSON.stringify(updates.middleware).replace(/'/g, "''")}'::jsonb`);
    
    setParts.push('updated_at = NOW()');
    
    const result = await sql`
      UPDATE aw_wrappers 
      SET ${sql.unsafe(setParts.join(', '))}
      WHERE share_code = ${code}
      RETURNING *
    `;
    
    if (result.length === 0) {
      return NextResponse.json(
        { error: 'Wrapper not found' },
        { status: 404 }
      );
    }
    
    return NextResponse.json(result[0]);
  } catch (error) {
    console.error('Error updating wrapper:', error);
    return NextResponse.json(
      { error: 'Failed to update wrapper' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  try {
    const { code } = await params;
    
    const result = await sql`
      DELETE FROM aw_wrappers 
      WHERE share_code = ${code}
      RETURNING id
    `;
    
    if (result.length === 0) {
      return NextResponse.json(
        { error: 'Wrapper not found' },
        { status: 404 }
      );
    }
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting wrapper:', error);
    return NextResponse.json(
      { error: 'Failed to delete wrapper' },
      { status: 500 }
    );
  }
}