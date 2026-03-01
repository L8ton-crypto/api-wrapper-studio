import { neon } from '@neondatabase/serverless';
import { NextRequest, NextResponse } from 'next/server';

const sql = neon(process.env.DATABASE_URL || 'postgresql://user:password@localhost:5432/db');

interface Endpoint {
  method: string;
  path: string;
  name: string;
  description?: string;
}

interface Middleware {
  rateLimit?: { enabled: boolean; requests: number; windowMs: number };
  cache?: { enabled: boolean; ttlSeconds: number };
  retry?: { enabled: boolean; attempts: number; backoffMs: number };
  timeout?: { enabled: boolean; ms: number };
}

interface WrapperConfig {
  base_url: string;
  auth_type: string;
  auth_config: any;
  endpoints: Endpoint[];
  middleware: Middleware;
}

function generateWrapperCode(config: WrapperConfig, name: string = 'APIWrapper'): string {
  const { base_url, auth_type, auth_config, endpoints, middleware } = config;
  
  const className = name.replace(/[^a-zA-Z0-9]/g, '') + 'Wrapper';
  
  let code = `// Generated API Wrapper for ${name}
// Created by API Wrapper Studio

interface RequestConfig {
  method: string;
  headers?: Record<string, string>;
  body?: string;
  timeout?: number;
}

interface CacheEntry {
  data: any;
  timestamp: number;
  ttl: number;
}

interface TokenBucket {
  tokens: number;
  lastRefill: number;
  capacity: number;
  refillRate: number;
}

export class ${className} {
  private baseUrl: string;
  private authConfig: any;
`;

  // Add cache if enabled
  if (middleware.cache?.enabled) {
    code += `  private cache: Map<string, CacheEntry> = new Map();
`;
  }

  // Add rate limiter if enabled
  if (middleware.rateLimit?.enabled) {
    code += `  private tokenBucket: TokenBucket;
`;
  }

  // Constructor
  code += `
  constructor(authConfig?: any) {
    this.baseUrl = '${base_url}';
    this.authConfig = authConfig || {};
`;

  if (middleware.rateLimit?.enabled) {
    const { requests, windowMs } = middleware.rateLimit;
    code += `    this.tokenBucket = {
      tokens: ${requests},
      lastRefill: Date.now(),
      capacity: ${requests},
      refillRate: ${requests} / ${windowMs} // tokens per ms
    };
`;
  }

  code += `  }
`;

  // Rate limiting method
  if (middleware.rateLimit?.enabled) {
    code += `
  private checkRateLimit(): boolean {
    const now = Date.now();
    const timePassed = now - this.tokenBucket.lastRefill;
    const tokensToAdd = Math.floor(timePassed * this.tokenBucket.refillRate);
    
    this.tokenBucket.tokens = Math.min(
      this.tokenBucket.capacity,
      this.tokenBucket.tokens + tokensToAdd
    );
    this.tokenBucket.lastRefill = now;
    
    if (this.tokenBucket.tokens >= 1) {
      this.tokenBucket.tokens -= 1;
      return true;
    }
    return false;
  }
`;
  }

  // Cache methods
  if (middleware.cache?.enabled) {
    code += `
  private getCached(key: string): any | null {
    const entry = this.cache.get(key);
    if (entry && Date.now() - entry.timestamp < entry.ttl * 1000) {
      return entry.data;
    }
    if (entry) {
      this.cache.delete(key);
    }
    return null;
  }

  private setCache(key: string, data: any): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl: ${middleware.cache.ttlSeconds}
    });
  }
`;
  }

  // Auth header method
  code += `
  private getAuthHeaders(): Record<string, string> {
    const headers: Record<string, string> = {};
    
    switch ('${auth_type}') {
      case 'api_key':
        const headerName = '${auth_config.headerName || 'X-API-Key'}';
        headers[headerName] = this.authConfig.apiKey || '';
        break;
      case 'bearer':
        headers['Authorization'] = \`Bearer \${this.authConfig.token || ''}\`;
        break;
      case 'basic':
        const encoded = btoa(\`\${this.authConfig.username || ''}:\${this.authConfig.password || ''}\`);
        headers['Authorization'] = \`Basic \${encoded}\`;
        break;
    }
    
    return headers;
  }
`;

  // Main request method
  code += `
  private async makeRequest(config: RequestConfig): Promise<any> {`;

  if (middleware.rateLimit?.enabled) {
    code += `
    if (!this.checkRateLimit()) {
      throw new Error('Rate limit exceeded');
    }
`;
  }

  code += `
    const headers = {
      'Content-Type': 'application/json',
      ...this.getAuthHeaders(),
      ...config.headers
    };

    const controller = new AbortController();`;

  if (middleware.timeout?.enabled) {
    code += `
    const timeoutId = setTimeout(() => controller.abort(), ${middleware.timeout.ms});`;
  }

  if (middleware.retry?.enabled) {
    const { attempts, backoffMs } = middleware.retry;
    code += `
    
    let lastError: Error;
    
    for (let attempt = 0; attempt < ${middleware.retry.attempts}; attempt++) {
      try {`;
  }

  code += `
        const response = await fetch(config.url || '', {
          method: config.method,
          headers,
          body: config.body,
          signal: controller.signal
        });
`;

  if (middleware.timeout?.enabled) {
    code += `        clearTimeout(timeoutId);
`;
  }

  code += `
        if (!response.ok) {
          throw new Error(\`HTTP \${response.status}: \${response.statusText}\`);
        }
        
        const result = await response.json();
        return result;`;

  if (middleware.retry?.enabled) {
    code += `
      } catch (error) {
        lastError = error as Error;
        if (attempt < ${middleware.retry.attempts - 1}) {
          await new Promise(resolve => setTimeout(resolve, ${middleware.retry.backoffMs} * Math.pow(2, attempt)));
          continue;
        }
        throw lastError;
      }
    }
`;
  } else {
    code += `
    } catch (error) {
      throw error;
    }`;
  }

  code += `
  }
`;

  // Generate endpoint methods
  endpoints.forEach(endpoint => {
    const methodName = endpoint.name.replace(/[^a-zA-Z0-9]/g, '');
    const pathWithParams = endpoint.path.replace(/:(\w+)/g, '${$1}');
    
    code += `
  /**
   * ${endpoint.description || `${endpoint.method} ${endpoint.path}`}
   */
  async ${methodName}(params: Record<string, any> = {}): Promise<any> {
    const url = \`\${this.baseUrl}${pathWithParams}\`;
    `;

    if (middleware.cache?.enabled && endpoint.method.toLowerCase() === 'get') {
      code += `
    const cacheKey = \`${endpoint.method}:\${url}\`;
    const cached = this.getCached(cacheKey);
    if (cached) {
      return cached;
    }
    `;
    }

    const hasBody = ['post', 'put', 'patch'].includes(endpoint.method.toLowerCase());
    
    code += `
    const config: RequestConfig = {
      method: '${endpoint.method.toUpperCase()}',
      url,${hasBody ? '\n      body: JSON.stringify(params)' : ''}
    };
    
    const result = await this.makeRequest(config);
    `;

    if (middleware.cache?.enabled && endpoint.method.toLowerCase() === 'get') {
      code += `
    this.setCache(cacheKey, result);`;
    }

    code += `
    return result;
  }
`;
  });

  code += `}

// Usage example:
// const wrapper = new ${className}({
//   ${auth_type === 'api_key' ? 'apiKey: "your-api-key"' : 
     auth_type === 'bearer' ? 'token: "your-bearer-token"' : 
     auth_type === 'basic' ? 'username: "user", password: "pass"' : '// No auth required'}
// });
`;

  return code;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    let wrapperConfig: WrapperConfig;
    let wrapperName = 'APIWrapper';
    let wrapper = null;
    
    if (body.wrapperId) {
      // Fetch from database
      const wrappers = await sql`
        SELECT * FROM aw_wrappers 
        WHERE share_code = ${body.wrapperId}
      `;
      
      if (wrappers.length === 0) {
        return NextResponse.json(
          { error: 'Wrapper not found' },
          { status: 404 }
        );
      }
      
      wrapper = wrappers[0];
      wrapperName = wrapper.name;
      wrapperConfig = {
        base_url: wrapper.base_url,
        auth_type: wrapper.auth_type,
        auth_config: wrapper.auth_config,
        endpoints: wrapper.endpoints,
        middleware: wrapper.middleware
      };
    } else {
      // Use inline config
      const { base_url, auth_type, auth_config, endpoints, middleware } = body;
      
      if (!base_url || !endpoints) {
        return NextResponse.json(
          { error: 'base_url and endpoints are required' },
          { status: 400 }
        );
      }
      
      wrapperConfig = {
        base_url,
        auth_type: auth_type || 'none',
        auth_config: auth_config || {},
        endpoints: endpoints || [],
        middleware: middleware || {}
      };
    }
    
    const code = generateWrapperCode(wrapperConfig, wrapperName);
    
    return NextResponse.json({ 
      code,
      wrapper 
    });
  } catch (error) {
    console.error('Error generating wrapper code:', error);
    return NextResponse.json(
      { error: 'Failed to generate wrapper code' },
      { status: 500 }
    );
  }
}