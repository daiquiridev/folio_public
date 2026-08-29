// Google Drive API Service for Full Browser Sync
// Manages authentication and file operations in the user's hidden AppData folder

class DriveService {
  constructor() {
    this.API_BASE = 'https://www.googleapis.com/drive/v3';
    this.UPLOAD_BASE = 'https://www.googleapis.com/upload/drive/v3';
    this.token = null;
  }

  // --- Authentication ---

  async getAuthToken(interactive = false) {
    return new Promise((resolve, reject) => {
      chrome.identity.getAuthToken({ interactive }, (token) => {
        if (chrome.runtime.lastError) {
          // If interactive is false, just return null instead of throwing
          if (!interactive) return resolve(null);
          console.error('Google Auth Error:', chrome.runtime.lastError);
          return reject(new Error(chrome.runtime.lastError.message));
        }
        this.token = token;
        resolve(token);
      });
    });
  }

  async isAuthenticated() {
    const token = await this.getAuthToken(false);
    return !!token;
  }

  // --- File Operations ---

  async findFile(filename) {
    const token = await this.getAuthToken();
    if (!token) throw new Error('Not authenticated');

    const params = new URLSearchParams({
      q: `name = '${filename}' and 'appDataFolder' in parents and trashed = false`,
      spaces: 'appDataFolder',
      fields: 'files(id, name, modifiedTime)'
    });

    const res = await fetch(`${this.API_BASE}/files?${params.toString()}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });

    if (!res.ok) throw new Error(`Drive API Error: ${res.status}`);
    const data = await res.json();
    return data.files && data.files.length > 0 ? data.files[0] : null;
  }

  async uploadFile(filename, content) {
    const token = await this.getAuthToken(true);
    const existingFile = await this.findFile(filename);
    
    const fileContent = JSON.stringify(content);
    const metadata = {
      name: filename,
      mimeType: 'application/json',
      parents: existingFile ? undefined : ['appDataFolder']
    };

    const formData = new FormData();
    formData.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
    formData.append('file', new Blob([fileContent], { type: 'application/json' }));

    let url = `${this.UPLOAD_BASE}/files?uploadType=multipart`;
    let method = 'POST';

    if (existingFile) {
      url = `${this.UPLOAD_BASE}/files/${existingFile.id}?uploadType=multipart`;
      method = 'PATCH';
    }

    const res = await fetch(url, {
      method: method,
      headers: { 'Authorization': `Bearer ${token}` },
      body: formData
    });

    if (!res.ok) throw new Error(`Upload Failed: ${res.status}`);
    return await res.json();
  }

  async downloadFile(filename) {
    const file = await this.findFile(filename);
    if (!file) return null;

    const token = await this.getAuthToken();
    const res = await fetch(`${this.API_BASE}/files/${file.id}?alt=media`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });

    if (!res.ok) throw new Error(`Download Failed: ${res.status}`);
    return await res.json();
  }

  async deleteFile(filename) {
    const file = await this.findFile(filename);
    if (!file) return;

    const token = await this.getAuthToken();
    await fetch(`${this.API_BASE}/files/${file.id}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${token}` }
    });
  }
}

// Global instance
window.driveService = new DriveService();
