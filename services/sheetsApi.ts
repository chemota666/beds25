
/**
 * INSTRUCCIONES PARA GOOGLE APPS SCRIPT:
 * 1. Abre tu Google Spreadsheet (beds25).
 * 2. Ve a Extensiones > Apps Script.
 * 3. Borra todo y pega el código de abajo (ver final de este archivo).
 * 4. Haz clic en "Implementar" > "Nueva implementación".
 * 5. Tipo: "Aplicación web". Ejecutar como: "Yo". Quién tiene acceso: "Cualquiera".
 * 6. Copia la URL de la aplicación web y ponla en la variable SHEETS_API_URL abajo.
 */

const SHEETS_API_URL = "https://script.google.com/macros/s/AKfycbz29QESg-LxFR2qdDX8cEA0BRFRv-cMtrqPR59TDnVWzrxikwm7CwKHeiUm2zcXF4YB4w/exec";

export const sheetsApi = {
  fetchSheet: async (sheetName: string) => {
    try {
      const response = await fetch(`${SHEETS_API_URL}?sheet=${sheetName}`);
      if (!response.ok) throw new Error('Network response was not ok');
      return await response.json();
    } catch (error) {
      console.error(`Error fetching ${sheetName}:`, error);
      // Fallback a localStorage si el script no está configurado aún
      const local = localStorage.getItem(`roomflow_${sheetName}`);
      return local ? JSON.parse(local) : [];
    }
  },

  postAction: async (sheetName: string, action: 'append' | 'update' | 'delete', data: any, id?: string) => {
    try {
      const response = await fetch(SHEETS_API_URL, {
        method: 'POST',
        mode: 'no-cors', // Apps Script requiere no-cors o un manejo especial de redirecciones
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sheet: sheetName, action, data, id })
      });
      // Con no-cors no podemos leer la respuesta, pero el servidor procesará la petición.
      // Para un sistema real se recomienda un proxy o manejar el redirect de Google.
      return true;
    } catch (error) {
      console.error(`Error in ${action} on ${sheetName}:`, error);
      return false;
    }
  }
};

/* 
CÓDIGO PARA COPIAR EN GOOGLE APPS SCRIPT:

function doGet(e) {
  const sheetName = e.parameter.sheet;
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(sheetName);
  if (!sheet) return ContentService.createTextOutput("Sheet not found").setMimeType(ContentService.MimeType.TEXT);
  
  const data = sheet.getDataRange().getValues();
  if (data.length < 2) return ContentService.createTextOutput(JSON.stringify([])).setMimeType(ContentService.MimeType.JSON);
  
  const headers = data[0];
  const rows = data.slice(1);
  const result = rows.map(row => {
    let obj = {};
    headers.forEach((header, i) => {
      let val = row[i];
      // Manejo de tipos booleanos almacenados como string
      if (val === "true") val = true;
      if (val === "false") val = false;
      obj[header] = val;
    });
    return obj;
  });
  return ContentService.createTextOutput(JSON.stringify(result)).setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  const params = JSON.parse(e.postData.contents);
  const action = params.action;
  const sheetName = params.sheet;
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(sheetName);
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  
  if (action === 'append') {
    const row = headers.map(h => params.data[h] !== undefined ? params.data[h] : '');
    sheet.appendRow(row);
  } else if (action === 'update' || action === 'delete') {
    const id = params.id;
    const idIndex = headers.indexOf('id');
    for (let i = 1; i < data.length; i++) {
      if (data[i][idIndex] == id) {
        if (action === 'update') {
          const newRow = headers.map(h => params.data[h] !== undefined ? params.data[h] : data[i][headers.indexOf(h)]);
          sheet.getRange(i + 1, 1, 1, headers.length).setValues([newRow]);
        } else {
          sheet.deleteRow(i + 1);
        }
        break;
      }
    }
  }
  return ContentService.createTextOutput(JSON.stringify({status: 'success'})).setMimeType(ContentService.MimeType.JSON);
}
*/
