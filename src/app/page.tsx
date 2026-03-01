'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronRight, Download, Copy, Plus, Trash2, Settings, Code2, Zap, Shield, Timer, Gauge, Loader2 } from 'lucide-react'

interface Endpoint {
  method: string;
  path: string;
  name: string;
  description: string;
}

interface Middleware {
  rateLimit: {
    enabled: boolean;
    requests: number;
    windowMs: number;
  };
  cache: {
    enabled: boolean;
    ttlSeconds: number;
  };
  retry: {
    enabled: boolean;
    attempts: number;
    backoffMs: number;
  };
  timeout: {
    enabled: boolean;
    ms: number;
  };
}

interface Wrapper {
  id: string;
  name: string;
  base_url: string;
  auth_type: string;
  auth_config: any;
  endpoints: Endpoint[];
  middleware: Middleware;
  share_code: string;
  created_at: string;
  updated_at: string;
}

const STEPS = [
  { id: 'api', title: 'Define API', icon: Settings },
  { id: 'endpoints', title: 'Endpoints', icon: Code2 },
  { id: 'middleware', title: 'Middleware', icon: Shield },
  { id: 'generate', title: 'Generate', icon: Zap },
]

const HTTP_METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE']
const AUTH_TYPES = ['none', 'api_key', 'bearer', 'basic']

export default function HomePage() {
  const [currentStep, setCurrentStep] = useState(0)
  const [loading, setLoading] = useState(false)
  const [generatedCode, setGeneratedCode] = useState('')
  const [recentWrappers, setRecentWrappers] = useState<Wrapper[]>([])
  const [saveStatus, setSaveStatus] = useState('')

  // Form data
  const [apiName, setApiName] = useState('')
  const [baseUrl, setBaseUrl] = useState('')
  const [authType, setAuthType] = useState('none')
  const [authConfig, setAuthConfig] = useState({ headerName: 'X-API-Key' })
  const [endpoints, setEndpoints] = useState<Endpoint[]>([
    { method: 'GET', path: '', name: '', description: '' }
  ])
  const [middleware, setMiddleware] = useState<Middleware>({
    rateLimit: { enabled: false, requests: 100, windowMs: 60000 },
    cache: { enabled: false, ttlSeconds: 300 },
    retry: { enabled: true, attempts: 3, backoffMs: 1000 },
    timeout: { enabled: true, ms: 10000 }
  })

  useEffect(() => {
    fetchRecentWrappers()
  }, [])

  const fetchRecentWrappers = async () => {
    try {
      const response = await fetch('/api/wrappers')
      if (response.ok) {
        const wrappers = await response.json()
        setRecentWrappers(wrappers)
      }
    } catch (error) {
      console.error('Error fetching wrappers:', error)
    }
  }

  const generateEndpointName = (method: string, path: string) => {
    const cleanPath = path.replace(/^\//, '').replace(/[:/{}]/g, '').replace(/\s+/g, '')
    const methodLower = method.toLowerCase()
    
    if (!cleanPath) return methodLower
    
    const pathWords = cleanPath.split(/[-_/]/).map(word => 
      word.charAt(0).toUpperCase() + word.slice(1)
    ).join('')
    
    return methodLower + pathWords
  }

  const addEndpoint = () => {
    setEndpoints([...endpoints, { method: 'GET', path: '', name: '', description: '' }])
  }

  const updateEndpoint = (index: number, field: keyof Endpoint, value: string) => {
    const updated = [...endpoints]
    updated[index][field] = value
    
    if (field === 'method' || field === 'path') {
      updated[index].name = generateEndpointName(updated[index].method, updated[index].path)
    }
    
    setEndpoints(updated)
  }

  const removeEndpoint = (index: number) => {
    if (endpoints.length > 1) {
      setEndpoints(endpoints.filter((_, i) => i !== index))
    }
  }

  const generateWrapper = async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          base_url: baseUrl,
          auth_type: authType,
          auth_config: authConfig,
          endpoints,
          middleware
        })
      })
      
      if (response.ok) {
        const data = await response.json()
        setGeneratedCode(data.code)
      } else {
        alert('Failed to generate wrapper')
      }
    } catch (error) {
      console.error('Error generating wrapper:', error)
      alert('Error generating wrapper')
    }
    setLoading(false)
  }

  const saveWrapper = async () => {
    setLoading(true)
    setSaveStatus('')
    try {
      const response = await fetch('/api/wrappers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: apiName,
          base_url: baseUrl,
          auth_type: authType,
          auth_config: authConfig,
          endpoints,
          middleware
        })
      })
      
      if (response.ok) {
        const wrapper = await response.json()
        setSaveStatus(`Saved! Share code: ${wrapper.share_code}`)
        fetchRecentWrappers()
      } else {
        setSaveStatus('Failed to save wrapper')
      }
    } catch (error) {
      console.error('Error saving wrapper:', error)
      setSaveStatus('Error saving wrapper')
    }
    setLoading(false)
  }

  const copyCode = () => {
    navigator.clipboard.writeText(generatedCode)
    alert('Code copied to clipboard!')
  }

  const downloadCode = () => {
    const blob = new Blob([generatedCode], { type: 'text/typescript' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${apiName.replace(/[^a-zA-Z0-9]/g, '') || 'api'}-wrapper.ts`
    a.click()
    URL.revokeObjectURL(url)
  }

  const loadWrapper = (wrapper: Wrapper) => {
    setApiName(wrapper.name)
    setBaseUrl(wrapper.base_url)
    setAuthType(wrapper.auth_type)
    setAuthConfig(wrapper.auth_config)
    setEndpoints(wrapper.endpoints)
    setMiddleware(wrapper.middleware)
    setCurrentStep(0)
    
    // Scroll to builder
    document.getElementById('builder')?.scrollIntoView({ behavior: 'smooth' })
  }

  const scrollToBuilder = () => {
    document.getElementById('builder')?.scrollIntoView({ behavior: 'smooth' })
  }

  return (
    <div className="min-h-screen bg-zinc-950">
      {/* Hero Section */}
      <div className="relative px-6 py-32">
        <div className="max-w-4xl mx-auto text-center">
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-6xl font-bold mb-6 text-zinc-100"
          >
            API Wrapper Studio
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-xl text-zinc-300 mb-8 max-w-2xl mx-auto"
          >
            Build type-safe API wrappers with middleware in minutes. No boilerplate.
          </motion.p>
          <motion.button
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            onClick={scrollToBuilder}
            className="bg-emerald-500 hover:bg-emerald-400 text-white px-8 py-4 rounded-xl font-semibold flex items-center gap-2 mx-auto transition-colors"
          >
            Start Building
            <ChevronRight className="w-5 h-5" />
          </motion.button>
        </div>
      </div>

      {/* Builder Section */}
      <div id="builder" className="px-6 py-16">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl font-bold text-zinc-100 mb-12 text-center">
            Build Your Wrapper
          </h2>

          {/* Steps */}
          <div className="flex justify-center mb-12">
            <div className="flex space-x-4">
              {STEPS.map((step, index) => {
                const Icon = step.icon
                return (
                  <button
                    key={step.id}
                    onClick={() => setCurrentStep(index)}
                    className={`flex items-center gap-3 px-6 py-3 rounded-xl transition-colors ${
                      currentStep === index
                        ? 'bg-emerald-500 text-white'
                        : currentStep > index
                        ? 'bg-zinc-700 text-zinc-100'
                        : 'bg-zinc-800 text-zinc-400'
                    }`}
                  >
                    <Icon className="w-5 h-5" />
                    <span className="font-medium">{step.title}</span>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Step Content */}
          <div className="bg-zinc-900 rounded-2xl p-8 mb-12">
            <AnimatePresence mode="wait">
              {currentStep === 0 && (
                <motion.div
                  key="api"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="space-y-6"
                >
                  <h3 className="text-2xl font-bold text-zinc-100 mb-6">Define Your API</h3>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-zinc-300 font-medium mb-2">API Name</label>
                      <input
                        value={apiName}
                        onChange={(e) => setApiName(e.target.value)}
                        placeholder="My API Wrapper"
                        className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-3 text-zinc-100 focus:border-emerald-500 outline-none"
                      />
                    </div>
                    
                    <div>
                      <label className="block text-zinc-300 font-medium mb-2">Base URL</label>
                      <input
                        value={baseUrl}
                        onChange={(e) => setBaseUrl(e.target.value)}
                        placeholder="https://api.example.com/v1"
                        className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-3 text-zinc-100 focus:border-emerald-500 outline-none"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-zinc-300 font-medium mb-2">Authentication Type</label>
                    <select
                      value={authType}
                      onChange={(e) => setAuthType(e.target.value)}
                      className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-3 text-zinc-100 focus:border-emerald-500 outline-none"
                    >
                      <option value="none">None</option>
                      <option value="api_key">API Key</option>
                      <option value="bearer">Bearer Token</option>
                      <option value="basic">Basic Auth</option>
                    </select>
                  </div>

                  {authType === 'api_key' && (
                    <div>
                      <label className="block text-zinc-300 font-medium mb-2">Header Name</label>
                      <input
                        value={authConfig.headerName || 'X-API-Key'}
                        onChange={(e) => setAuthConfig({ ...authConfig, headerName: e.target.value })}
                        className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-3 text-zinc-100 focus:border-emerald-500 outline-none"
                      />
                    </div>
                  )}

                  {authType === 'bearer' && (
                    <div className="bg-zinc-800 border border-zinc-700 rounded-lg p-4">
                      <p className="text-zinc-300">Bearer token will be passed at runtime</p>
                    </div>
                  )}

                  {authType === 'basic' && (
                    <div className="bg-zinc-800 border border-zinc-700 rounded-lg p-4">
                      <p className="text-zinc-300">Username and password will be passed at runtime</p>
                    </div>
                  )}
                </motion.div>
              )}

              {currentStep === 1 && (
                <motion.div
                  key="endpoints"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="space-y-6"
                >
                  <div className="flex items-center justify-between">
                    <h3 className="text-2xl font-bold text-zinc-100">Define Endpoints</h3>
                    <button
                      onClick={addEndpoint}
                      className="bg-emerald-500 hover:bg-emerald-400 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-colors"
                    >
                      <Plus className="w-4 h-4" />
                      Add Endpoint
                    </button>
                  </div>

                  <div className="space-y-4">
                    {endpoints.map((endpoint, index) => (
                      <div key={index} className="bg-zinc-800 border border-zinc-700 rounded-lg p-6">
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                          <div>
                            <label className="block text-zinc-300 font-medium mb-2">Method</label>
                            <select
                              value={endpoint.method}
                              onChange={(e) => updateEndpoint(index, 'method', e.target.value)}
                              className="w-full bg-zinc-700 border border-zinc-600 rounded-lg px-3 py-2 text-zinc-100 focus:border-emerald-500 outline-none"
                            >
                              {HTTP_METHODS.map(method => (
                                <option key={method} value={method}>{method}</option>
                              ))}
                            </select>
                          </div>

                          <div>
                            <label className="block text-zinc-300 font-medium mb-2">Path</label>
                            <input
                              value={endpoint.path}
                              onChange={(e) => updateEndpoint(index, 'path', e.target.value)}
                              placeholder="/users/:id"
                              className="w-full bg-zinc-700 border border-zinc-600 rounded-lg px-3 py-2 text-zinc-100 focus:border-emerald-500 outline-none"
                            />
                          </div>

                          <div>
                            <label className="block text-zinc-300 font-medium mb-2">Name</label>
                            <input
                              value={endpoint.name}
                              onChange={(e) => updateEndpoint(index, 'name', e.target.value)}
                              placeholder="Auto-generated"
                              className="w-full bg-zinc-700 border border-zinc-600 rounded-lg px-3 py-2 text-zinc-100 focus:border-emerald-500 outline-none"
                            />
                          </div>

                          <div className="flex items-end">
                            {endpoints.length > 1 && (
                              <button
                                onClick={() => removeEndpoint(index)}
                                className="bg-red-500 hover:bg-red-400 text-white p-2 rounded-lg transition-colors"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </div>

                        <div className="mt-4">
                          <label className="block text-zinc-300 font-medium mb-2">Description</label>
                          <input
                            value={endpoint.description}
                            onChange={(e) => updateEndpoint(index, 'description', e.target.value)}
                            placeholder="Optional description"
                            className="w-full bg-zinc-700 border border-zinc-600 rounded-lg px-3 py-2 text-zinc-100 focus:border-emerald-500 outline-none"
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </motion.div>
              )}

              {currentStep === 2 && (
                <motion.div
                  key="middleware"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="space-y-6"
                >
                  <h3 className="text-2xl font-bold text-zinc-100 mb-6">Configure Middleware</h3>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    {/* Rate Limiting */}
                    <div className="bg-zinc-800 border border-zinc-700 rounded-lg p-6">
                      <div className="flex items-center gap-3 mb-4">
                        <Gauge className="w-5 h-5 text-emerald-500" />
                        <div className="flex items-center justify-between flex-1">
                          <h4 className="text-lg font-semibold text-zinc-100">Rate Limiting</h4>
                          <label className="relative inline-flex items-center cursor-pointer">
                            <input
                              type="checkbox"
                              checked={middleware.rateLimit.enabled}
                              onChange={(e) => setMiddleware({
                                ...middleware,
                                rateLimit: { ...middleware.rateLimit, enabled: e.target.checked }
                              })}
                              className="sr-only peer"
                            />
                            <div className="w-11 h-6 bg-zinc-600 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500"></div>
                          </label>
                        </div>
                      </div>
                      {middleware.rateLimit.enabled && (
                        <div className="space-y-4">
                          <div>
                            <label className="block text-zinc-300 mb-2">Requests per window</label>
                            <input
                              type="number"
                              value={middleware.rateLimit.requests}
                              onChange={(e) => setMiddleware({
                                ...middleware,
                                rateLimit: { ...middleware.rateLimit, requests: parseInt(e.target.value) || 100 }
                              })}
                              className="w-full bg-zinc-700 border border-zinc-600 rounded-lg px-3 py-2 text-zinc-100 outline-none"
                            />
                          </div>
                          <div>
                            <label className="block text-zinc-300 mb-2">Window (ms)</label>
                            <input
                              type="number"
                              value={middleware.rateLimit.windowMs}
                              onChange={(e) => setMiddleware({
                                ...middleware,
                                rateLimit: { ...middleware.rateLimit, windowMs: parseInt(e.target.value) || 60000 }
                              })}
                              className="w-full bg-zinc-700 border border-zinc-600 rounded-lg px-3 py-2 text-zinc-100 outline-none"
                            />
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Caching */}
                    <div className="bg-zinc-800 border border-zinc-700 rounded-lg p-6">
                      <div className="flex items-center gap-3 mb-4">
                        <Timer className="w-5 h-5 text-emerald-500" />
                        <div className="flex items-center justify-between flex-1">
                          <h4 className="text-lg font-semibold text-zinc-100">Caching</h4>
                          <label className="relative inline-flex items-center cursor-pointer">
                            <input
                              type="checkbox"
                              checked={middleware.cache.enabled}
                              onChange={(e) => setMiddleware({
                                ...middleware,
                                cache: { ...middleware.cache, enabled: e.target.checked }
                              })}
                              className="sr-only peer"
                            />
                            <div className="w-11 h-6 bg-zinc-600 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500"></div>
                          </label>
                        </div>
                      </div>
                      {middleware.cache.enabled && (
                        <div>
                          <label className="block text-zinc-300 mb-2">TTL (seconds)</label>
                          <input
                            type="number"
                            value={middleware.cache.ttlSeconds}
                            onChange={(e) => setMiddleware({
                              ...middleware,
                              cache: { ...middleware.cache, ttlSeconds: parseInt(e.target.value) || 300 }
                            })}
                            className="w-full bg-zinc-700 border border-zinc-600 rounded-lg px-3 py-2 text-zinc-100 outline-none"
                          />
                        </div>
                      )}
                    </div>

                    {/* Retry */}
                    <div className="bg-zinc-800 border border-zinc-700 rounded-lg p-6">
                      <div className="flex items-center gap-3 mb-4">
                        <Shield className="w-5 h-5 text-emerald-500" />
                        <div className="flex items-center justify-between flex-1">
                          <h4 className="text-lg font-semibold text-zinc-100">Retry</h4>
                          <label className="relative inline-flex items-center cursor-pointer">
                            <input
                              type="checkbox"
                              checked={middleware.retry.enabled}
                              onChange={(e) => setMiddleware({
                                ...middleware,
                                retry: { ...middleware.retry, enabled: e.target.checked }
                              })}
                              className="sr-only peer"
                            />
                            <div className="w-11 h-6 bg-zinc-600 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500"></div>
                          </label>
                        </div>
                      </div>
                      {middleware.retry.enabled && (
                        <div className="space-y-4">
                          <div>
                            <label className="block text-zinc-300 mb-2">Max attempts</label>
                            <input
                              type="number"
                              value={middleware.retry.attempts}
                              onChange={(e) => setMiddleware({
                                ...middleware,
                                retry: { ...middleware.retry, attempts: parseInt(e.target.value) || 3 }
                              })}
                              className="w-full bg-zinc-700 border border-zinc-600 rounded-lg px-3 py-2 text-zinc-100 outline-none"
                            />
                          </div>
                          <div>
                            <label className="block text-zinc-300 mb-2">Backoff (ms)</label>
                            <input
                              type="number"
                              value={middleware.retry.backoffMs}
                              onChange={(e) => setMiddleware({
                                ...middleware,
                                retry: { ...middleware.retry, backoffMs: parseInt(e.target.value) || 1000 }
                              })}
                              className="w-full bg-zinc-700 border border-zinc-600 rounded-lg px-3 py-2 text-zinc-100 outline-none"
                            />
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Timeout */}
                    <div className="bg-zinc-800 border border-zinc-700 rounded-lg p-6">
                      <div className="flex items-center gap-3 mb-4">
                        <Timer className="w-5 h-5 text-emerald-500" />
                        <div className="flex items-center justify-between flex-1">
                          <h4 className="text-lg font-semibold text-zinc-100">Timeout</h4>
                          <label className="relative inline-flex items-center cursor-pointer">
                            <input
                              type="checkbox"
                              checked={middleware.timeout.enabled}
                              onChange={(e) => setMiddleware({
                                ...middleware,
                                timeout: { ...middleware.timeout, enabled: e.target.checked }
                              })}
                              className="sr-only peer"
                            />
                            <div className="w-11 h-6 bg-zinc-600 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500"></div>
                          </label>
                        </div>
                      </div>
                      {middleware.timeout.enabled && (
                        <div>
                          <label className="block text-zinc-300 mb-2">Timeout (ms)</label>
                          <input
                            type="number"
                            value={middleware.timeout.ms}
                            onChange={(e) => setMiddleware({
                              ...middleware,
                              timeout: { ...middleware.timeout, ms: parseInt(e.target.value) || 10000 }
                            })}
                            className="w-full bg-zinc-700 border border-zinc-600 rounded-lg px-3 py-2 text-zinc-100 outline-none"
                          />
                        </div>
                      )}
                    </div>
                  </div>
                </motion.div>
              )}

              {currentStep === 3 && (
                <motion.div
                  key="generate"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="space-y-6"
                >
                  <h3 className="text-2xl font-bold text-zinc-100 mb-6">Generate & Preview</h3>

                  <div className="flex gap-4">
                    <button
                      onClick={generateWrapper}
                      disabled={loading}
                      className="bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-white px-6 py-3 rounded-lg font-semibold flex items-center gap-2 transition-colors"
                    >
                      {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Code2 className="w-5 h-5" />}
                      Generate Wrapper
                    </button>

                    {generatedCode && (
                      <>
                        <button
                          onClick={copyCode}
                          className="bg-zinc-700 hover:bg-zinc-600 text-zinc-100 px-6 py-3 rounded-lg font-semibold flex items-center gap-2 transition-colors"
                        >
                          <Copy className="w-4 h-4" />
                          Copy
                        </button>
                        <button
                          onClick={downloadCode}
                          className="bg-zinc-700 hover:bg-zinc-600 text-zinc-100 px-6 py-3 rounded-lg font-semibold flex items-center gap-2 transition-colors"
                        >
                          <Download className="w-4 h-4" />
                          Download
                        </button>
                        <button
                          onClick={saveWrapper}
                          disabled={loading}
                          className="bg-blue-500 hover:bg-blue-400 disabled:opacity-50 text-white px-6 py-3 rounded-lg font-semibold transition-colors"
                        >
                          {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Save Wrapper'}
                        </button>
                      </>
                    )}
                  </div>

                  {saveStatus && (
                    <div className={`p-4 rounded-lg ${saveStatus.includes('Failed') || saveStatus.includes('Error') ? 'bg-red-500/20 text-red-300' : 'bg-emerald-500/20 text-emerald-300'}`}>
                      {saveStatus}
                    </div>
                  )}

                  {generatedCode && (
                    <div className="bg-zinc-800 border border-zinc-700 rounded-lg overflow-hidden">
                      <div className="px-4 py-3 border-b border-zinc-700 flex justify-between items-center">
                        <h4 className="text-zinc-100 font-semibold">Generated TypeScript Wrapper</h4>
                        <div className="text-sm text-zinc-400">{generatedCode.split('\n').length} lines</div>
                      </div>
                      <pre className="p-4 text-sm text-zinc-300 overflow-x-auto max-h-96 bg-zinc-900">
                        <code>{generatedCode}</code>
                      </pre>
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Navigation */}
          <div className="flex justify-between">
            <button
              onClick={() => setCurrentStep(Math.max(0, currentStep - 1))}
              disabled={currentStep === 0}
              className="bg-zinc-700 hover:bg-zinc-600 disabled:opacity-50 text-zinc-100 px-6 py-3 rounded-lg font-semibold transition-colors"
            >
              Previous
            </button>
            <button
              onClick={() => setCurrentStep(Math.min(STEPS.length - 1, currentStep + 1))}
              disabled={currentStep === STEPS.length - 1}
              className="bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-white px-6 py-3 rounded-lg font-semibold transition-colors"
            >
              Next
            </button>
          </div>
        </div>
      </div>

      {/* Recent Wrappers Gallery */}
      {recentWrappers.length > 0 && (
        <div className="px-6 py-16 bg-zinc-900">
          <div className="max-w-6xl mx-auto">
            <h2 className="text-3xl font-bold text-zinc-100 mb-12 text-center">
              Recent Wrappers
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {recentWrappers.slice(0, 10).map((wrapper, index) => (
                <motion.div
                  key={wrapper.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                  onClick={() => loadWrapper(wrapper)}
                  className="bg-zinc-800 hover:bg-zinc-750 border border-zinc-700 rounded-xl p-6 cursor-pointer transition-colors"
                >
                  <h3 className="text-xl font-semibold text-zinc-100 mb-2">{wrapper.name}</h3>
                  <p className="text-zinc-400 mb-4 text-sm">{wrapper.base_url}</p>
                  <div className="flex justify-between items-center text-sm text-zinc-500">
                    <span>{wrapper.endpoints.length} endpoints</span>
                    <span>{wrapper.share_code}</span>
                  </div>
                  <div className="text-xs text-zinc-600 mt-2">
                    {new Date(wrapper.created_at).toLocaleDateString()}
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}