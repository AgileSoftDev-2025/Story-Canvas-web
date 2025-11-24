export interface ExportConfig {
  include_stories: boolean;
  include_wireframes: boolean;
  include_scenarios: boolean;
  format: "zip";
}

export interface ProjectData {
  project_id: string;
  title: string;
  domain: string;
  objective: string;
  user_stories: any[];
  wireframes: any[];
  scenarios: any[];
}

class ExportService {
  private baseURL = "http://127.0.0.1:8000/api";

  private async makeRequest(url: string, options: RequestInit = {}) {
    const requestId = Math.random().toString(36).substring(2, 9);
    console.group(`🌐 [${requestId}] API REQUEST: ${options.method || "GET"} ${url}`);

    try {
      const token = localStorage.getItem("access_token");
      console.log(`🔑 [${requestId}] Token available:`, !!token);
      if (token) {
        console.log(`🔑 [${requestId}] Token preview:`, token.substring(0, 20) + "...");
      }

      const headers: HeadersInit = {
        "Content-Type": "application/json",
      };

      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }

      console.log(`📋 [${requestId}] Request headers:`, headers);
      console.log(`⚙️ [${requestId}] Request options:`, {
        method: options.method,
        body: options.body ? JSON.parse(options.body as string) : "No body",
      });

      const startTime = Date.now();
      console.log(`⏰ [${requestId}] Request started at:`, new Date().toISOString());

      const response = await fetch(url, {
        headers,
        ...options,
      });

      const endTime = Date.now();
      const duration = endTime - startTime;

      console.log(`⏱️ [${requestId}] Request duration: ${duration}ms`);
      console.log(`📡 [${requestId}] Response status: ${response.status} ${response.statusText}`);
      console.log(`🔗 [${requestId}] Response headers:`, Object.fromEntries(response.headers.entries()));
      console.log(`📊 [${requestId}] Response OK:`, response.ok);
      console.log(`🔄 [${requestId}] Response redirected:`, response.redirected);
      console.log(`🔒 [${requestId}] Response type:`, response.type);

      // Clone response untuk error handling
      const responseClone = response.clone();

      if (!response.ok) {
        console.error(`❌ [${requestId}] HTTP Error: ${response.status} ${response.statusText}`);

        let errorDetails = "";
        let contentType = response.headers.get("content-type");
        console.log(`📄 [${requestId}] Response content-type:`, contentType);
        console.log(`📏 [${requestId}] Response body used:`, response.bodyUsed);

        try {
          if (contentType && contentType.includes("application/json")) {
            const errorData = await responseClone.json();
            console.error(`📊 [${requestId}] Error response JSON:`, errorData);
            errorDetails = errorData.error || errorData.detail || errorData.message || JSON.stringify(errorData);
          } else {
            const text = await responseClone.text();
            console.error(`📝 [${requestId}] Error response text:`, text);
            errorDetails = text || response.statusText;

            // Coba parse sebagai JSON jika text mengandung JSON
            if (text.trim().startsWith("{") || text.trim().startsWith("[")) {
              try {
                const jsonAttempt = JSON.parse(text);
                console.error(`🔍 [${requestId}] Parsed error text as JSON:`, jsonAttempt);
                errorDetails = jsonAttempt.error || jsonAttempt.detail || jsonAttempt.message || text;
              } catch (e) {
                // Tetap gunakan text asli
              }
            }
          }
        } catch (parseError: any) {
          console.error(`🚨 [${requestId}] Error parsing error response:`, parseError);
          console.error(`🚨 [${requestId}] Parse error details:`, parseError.message);
          errorDetails = `Failed to parse error response: ${parseError.message}`;
        }

        if (response.status === 500) {
          const serverError = new Error(`Server Error (500): ${errorDetails || "Internal server error"}`);
          console.error(`🔥 [${requestId}] Server Error Details:`, {
            message: serverError.message,
            stack: serverError.stack,
          });
          throw serverError;
        }

        if (response.status === 404) {
          const notFoundError = new Error(`Not Found (404): ${errorDetails || "Resource not found"}`);
          console.error(`🔍 [${requestId}] Not Found Error:`, notFoundError.message);
          throw notFoundError;
        }

        if (response.status === 401) {
          const authError = new Error(`Unauthorized (401): ${errorDetails || "Authentication required"}`);
          console.error(`🔐 [${requestId}] Auth Error:`, authError.message);
          throw authError;
        }

        if (response.status === 403) {
          const forbiddenError = new Error(`Forbidden (403): ${errorDetails || "Access denied"}`);
          console.error(`🚫 [${requestId}] Forbidden Error:`, forbiddenError.message);
          throw forbiddenError;
        }

        const httpError = new Error(`HTTP ${response.status}: ${errorDetails || response.statusText}`);
        console.error(`💥 [${requestId}] HTTP Error Details:`, {
          message: httpError.message,
          status: response.status,
          statusText: response.statusText,
        });
        throw httpError;
      }

      console.log(`✅ [${requestId}] Request successful`);
      return response;
    } catch (error: any) {
      console.error(`❌ [${requestId}] Request failed completely:`, {
        name: error.name,
        message: error.message,
        stack: error.stack,
        constructor: error.constructor.name,
      });

      if (error.message.includes("Failed to fetch")) {
        const connectionError = new Error(`Cannot connect to backend server. Please check:
• Django server running on http://127.0.0.1:8000
• CORS configuration
• Network connectivity
• Firewall settings`);
        console.error(`🔌 [${requestId}] Connection Error:`, connectionError.message);
        throw connectionError;
      }

      if (error.name === "TypeError") {
        console.error(`🔧 [${requestId}] TypeError details:`, {
          message: error.message,
          stack: error.stack,
          code: (error as any).code,
        });
      }

      if (error.name === "SyntaxError") {
        console.error(`📝 [${requestId}] SyntaxError details:`, {
          message: error.message,
          stack: error.stack,
        });
      }

      // Re-throw error dengan context tambahan
      error.requestId = requestId;
      throw error;
    } finally {
      console.groupEnd();
    }
  }

  async getExportPreview(projectId: string) {
    const requestId = Math.random().toString(36).substring(2, 9);
    console.group(`🔍 [${requestId}] GET EXPORT PREVIEW for project: ${projectId}`);

    try {
      console.log(`📦 [${requestId}] Building request parameters...`);
      console.log(`🆔 [${requestId}] Project ID:`, projectId);
      console.log(`🔍 [${requestId}] Project ID valid:`, typeof projectId === "string" && projectId.length > 0);

      const params = new URLSearchParams({
        include_stories: "true",
        include_wireframes: "true",
        include_scenarios: "true",
      });

      const url = `${this.baseURL}/projects/${projectId}/export-preview/?${params}`;
      console.log(`🎯 [${requestId}] Full request URL:`, url);
      console.log(`📊 [${requestId}] Query parameters:`, Object.fromEntries(params.entries()));
      console.log(`🔗 [${requestId}] URL constructed:`, {
        baseURL: this.baseURL,
        projectId: projectId,
        endpoint: "export-preview",
        fullUrl: url,
      });

      console.log(`🚀 [${requestId}] Sending request to backend...`);
      const response = await this.makeRequest(url, {
        method: "GET",
      });

      console.log(`📥 [${requestId}] Processing response...`);
      console.log(`📄 [${requestId}] Response body used before text:`, response.bodyUsed);

      const responseText = await response.text();
      console.log(`📄 [${requestId}] Raw response text length:`, responseText.length);
      console.log(`📄 [${requestId}] Raw response text (first 500 chars):`, responseText.substring(0, 500));

      if (responseText.length === 0) {
        console.warn(`⚠️ [${requestId}] Empty response body received`);
      }

      let data;
      try {
        console.log(`🔄 [${requestId}] Attempting to parse JSON...`);
        data = JSON.parse(responseText);
        console.log(`✅ [${requestId}] Successfully parsed JSON response`);
        console.log(`📊 [${requestId}] Parsed data structure:`, {
          hasSuccess: "success" in data,
          success: data.success,
          hasData: "data" in data,
          hasError: "error" in data,
          keys: Object.keys(data),
        });
      } catch (parseError: any) {
        console.error(`🚨 [${requestId}] Failed to parse JSON response:`, parseError);
        console.error(`🚨 [${requestId}] Parse error details:`, parseError.message);
        console.error(`📄 [${requestId}] Problematic response text:`, responseText);

        throw new Error(`Invalid JSON response from server: ${parseError.message}. Response: ${responseText.substring(0, 200)}`);
      }

      console.log(`📊 [${requestId}] Parsed response data:`, data);

      if (data.success) {
        console.log(`🎉 [${requestId}] Preview data loaded successfully`);
        console.log(`📈 [${requestId}] Data summary:`, {
          project_title: data.data?.title || "No title",
          project_id: data.data?.project_id || "No ID",
          domain: data.data?.domain || "No domain",
          stories_count: data.data?.user_stories?.length || 0,
          wireframes_count: data.data?.wireframes?.length || 0,
          scenarios_count: data.data?.scenarios?.length || 0,
        });

        // Validasi data structure
        if (!data.data) {
          console.warn(`⚠️ [${requestId}] No data field in response`);
        }

        if (data.data && typeof data.data !== "object") {
          console.warn(`⚠️ [${requestId}] Data field is not an object:`, typeof data.data);
        }
      } else {
        console.error(`❌ [${requestId}] Backend returned error:`, data.error);
        console.error(`❌ [${requestId}] Full error response:`, data);

        throw new Error(data.error || "Unknown backend error");
      }

      return data;
    } catch (error: any) {
      console.error(`💥 [${requestId}] getExportPreview failed completely:`, {
        name: error.name,
        message: error.message,
        stack: error.stack,
        requestId: error.requestId,
        projectId: projectId,
      });

      // Cek jika error karena project tidak ditemukan
      if (error.message.includes("404") || error.message.includes("not found") || error.message.includes("Not Found")) {
        const notFoundError = new Error(`Project not found (ID: ${projectId}). Please check if the project exists.`);
        console.error(`🔍 [${requestId}] Project not found error:`, notFoundError.message);
        throw notFoundError;
      }

      // Cek jika error karena authentication
      if (error.message.includes("401") || error.message.includes("403") || error.message.includes("Unauthorized") || error.message.includes("Forbidden")) {
        const authError = new Error("Authentication failed. Please check your login status and try again.");
        console.error(`🔐 [${requestId}] Authentication error:`, authError.message);
        throw authError;
      }

      // Cek jika error karena server error
      if (error.message.includes("500") || error.message.includes("Server Error")) {
        const serverError = new Error(`Server error occurred. Please check backend logs. Project ID: ${projectId}`);
        console.error(`🔥 [${requestId}] Server error:`, serverError.message);
        throw serverError;
      }

      const enhancedError = new Error(`Export preview failed: ${error.message}`);
      enhancedError.cause = error;
      throw enhancedError;
    } finally {
      console.groupEnd();
    }
  }

  async exportProject(projectId: string, config: ExportConfig): Promise<Blob> {
    const requestId = Math.random().toString(36).substring(2, 9);
    console.group(`📤 [${requestId}] EXPORT PROJECT: ${projectId}`);

    try {
      console.log(`⚙️ [${requestId}] Export configuration:`, config);
      console.log(`📦 [${requestId}] Preparing export request...`);

      const url = `${this.baseURL}/projects/${projectId}/export/`;
      console.log(`🎯 [${requestId}] Export URL:`, url);

      const response = await this.makeRequest(url, {
        method: "POST",
        body: JSON.stringify({ config }),
      });

      console.log(`✅ [${requestId}] Export request successful, processing blob...`);
      const blob = await response.blob();
      console.log(`📦 [${requestId}] Blob details:`, {
        size: blob.size,
        type: blob.type,
        sizeKB: Math.round(blob.size / 1024),
      });

      if (blob.size === 0) {
        console.warn(`⚠️ [${requestId}] Empty blob received`);
      }

      return blob;
    } catch (error: any) {
      console.error(`💥 [${requestId}] Export project failed:`, {
        name: error.name,
        message: error.message,
        stack: error.stack,
        requestId: error.requestId,
      });

      const enhancedError = new Error(`Export failed: ${error.message}`);
      enhancedError.cause = error;
      throw enhancedError;
    } finally {
      console.groupEnd();
    }
  }

  downloadFile(blob: Blob, fileName: string) {
    console.group(`📥 DOWNLOAD FILE: ${fileName}`);
    console.log("📦 File details:", {
      size: blob.size,
      type: blob.type,
      name: fileName,
      sizeKB: Math.round(blob.size / 1024),
    });

    if (blob.size === 0) {
      console.error("❌ Cannot download empty file");
      alert("Cannot download empty file. Export may have failed.");
      return;
    }

    const url = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = fileName;
    link.style.display = "none";

    document.body.appendChild(link);
    console.log("🖱️ Triggering download...");
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);

    console.log("✅ Download initiated");
    console.groupEnd();
  }

  // Utility method untuk debug localStorage
  debugLocalStorage() {
    console.group("🔍 LOCAL STORAGE DEBUG");
    const token = localStorage.getItem("access_token");
    const projectId = localStorage.getItem("currentProjectId");
    const refreshToken = localStorage.getItem("refresh_token");

    console.log("🔑 Access Token:", token ? `Present (${token.length} chars)` : "Missing");
    console.log("🔄 Refresh Token:", refreshToken ? `Present (${refreshToken.length} chars)` : "Missing");
    console.log("📋 Current Project ID:", projectId || "Not set");

    if (token) {
      try {
        const tokenPayload = JSON.parse(atob(token.split(".")[1]));
        console.log("🔓 Token payload:", {
          exp: new Date(tokenPayload.exp * 1000),
          user_id: tokenPayload.user_id,
          username: tokenPayload.username,
        });
      } catch (e) {
        console.log("🔓 Token payload: Invalid JWT format");
      }
    }

    // Cek semua items di localStorage
    console.log("🗂️ All localStorage items:");
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key) {
        const value = localStorage.getItem(key);
        const isSensitive = key.includes("token") || key.includes("auth") || key.includes("password");
        console.log(`  ${key}: ${value ? (isSensitive ? "***" + value.substring(value.length - 10) : value.substring(0, 100) + (value.length > 100 ? "..." : "")) : "null"}`);
      }
    }
    console.groupEnd();
  }

  // Method untuk test koneksi backend
  async testBackendConnection(): Promise<boolean> {
    console.group("🧪 BACKEND CONNECTION TEST");
    try {
      const testUrl = `${this.baseURL}/`;
      console.log("🔗 Testing connection to:", testUrl);

      const startTime = Date.now();
      const response = await fetch(testUrl, { method: "GET" });
      const duration = Date.now() - startTime;

      console.log("📡 Test response:", {
        status: response.status,
        statusText: response.statusText,
        duration: `${duration}ms`,
        ok: response.ok,
      });

      const success = response.ok;
      console.log(success ? "✅ Backend connection successful" : "❌ Backend connection failed");
      console.groupEnd();
      return success;
    } catch (error: any) {
      console.error("💥 Backend connection test failed:", error);
      console.groupEnd();
      return false;
    }
  }
}

export const exportService = new ExportService();
