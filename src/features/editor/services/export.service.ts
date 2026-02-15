import {Injectable} from '@angular/core';
import JSZip from 'jszip';

@Injectable({providedIn: 'root'})
export class ExportService {

  async exportAll(data: Record<string, string>) {

    const zip = new JSZip();

    for (const [fileName, content] of Object.entries(data)) {
      zip.file(fileName, content);
    }

    zip.file('meta.json', JSON.stringify({
      exportedAt: new Date().toISOString(),
    }, null, 2));

    const blob = await zip.generateAsync({ type: 'blob' });

    const timestamp = this.createTimestamp();
    const filename = `vocab-export-${timestamp}.zip`;

    this.downloadBlob(blob, filename);
  }

  private createTimestamp(): string {
    const now = new Date();

    const pad = (value: number) => value.toString().padStart(2, '0');

    return `${now.getFullYear()}-${pad(now.getMonth()+1)}-${pad(now.getDate())}_${pad(now.getHours())}-${pad(now.getMinutes())}-${pad(now.getSeconds())}`;
  }

  private downloadBlob(blob: Blob, filename: string) {
    const url = URL.createObjectURL(blob);

    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    anchor.click();

    URL.revokeObjectURL(url);

  }

}
