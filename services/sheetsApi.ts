
/**
 * INSTRUCCIONES PARA GOOGLE APPS SCRIPT (IMPORTANTE):
 * 1. Abre tu Spreadsheet (beds25).
 * 2. Extensiones > Apps Script.
 * 3. Reemplaza TODO el código por el bloque de abajo.
 * 4. Haz clic en el icono de "Guardar".
 * 5. Haz clic en "Implementar" > "Nueva implementación".
 * 6. Tipo: "Aplicación web". Ejecutar como: "Yo". Acceso: "Cualquiera".
 * 7. Copia la URL resultante y pégala en SHEETS_API_URL abajo.
 * 
 * NOTA: La primera vez que lo ejecutes, Google te pedirá permisos para:
 * - Ver y gestionar archivos en Google Drive.
 * - Ver y gestionar tus hojas de cálculo.
 * 
 * ASEGÚRATE de que en tu hoja 'guests' existan las columnas:
 * id, name, surname, dni, nationality, sex, isRegistered, email, phone, notes, dniFile, contractFile, depositReceiptFile
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
      const local = localStorage.getItem(`roomflow_${sheetName}`);
      return local ? JSON.parse(local) : [];
    }
  },

  postAction: async (sheetName: string, action: 'append' | 'update' | 'delete', data: any, id?: string) => {
    try {
      await fetch(SHEETS_API_URL, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sheet: sheetName, action, data, id })
      });
      return true;
    } catch (error) {
      console.error(`Error in ${action} on ${sheetName}:`, error);
      return false;
    }
  }
};

/* 
CÓDIGO PARA GOOGLE APPS SCRIPT (COPIAR Y PEGAR):

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
  
  if (!sheet) return ContentService.createTextOutput("Sheet not found").setMimeType(ContentService.MimeType.TEXT);
  
  // LOGICA PARA MANEJAR ARCHIVOS EN GOOGLE DRIVE (Solo para tabla guests)
  if (sheetName === 'guests' && (action === 'append' || action === 'update')) {
    params.data = handleDriveUploads(params.data);
  }

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

function handleDriveUploads(guestData) {
  const rootFolderName = "RoomFlow_Documentos";
  const guestId = guestData.id;
  
  // Buscar o crear carpeta raíz
  let rootFolder;
  const folders = DriveApp.getFoldersByName(rootFolderName);
  if (folders.hasNext()) {
    rootFolder = folders.next();
  } else {
    rootFolder = DriveApp.createFolder(rootFolderName);
  }
  
  // Buscar o crear carpeta del huésped
  let guestFolder;
  const guestFolders = rootFolder.getFoldersByName(guestId);
  if (guestFolders.hasNext()) {
    guestFolder = guestFolders.next();
  } else {
    guestFolder = rootFolder.createFolder(guestId);
    guestFolder.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  }
  
  // Procesar cada campo de archivo
  const fileFields = ['dniFile', 'contractFile', 'depositReceiptFile'];
  const fieldNames = { 'dniFile': 'DNI', 'contractFile': 'Contrato', 'depositReceiptFile': 'Fianza' };
  
  fileFields.forEach(field => {
    const base64Data = guestData[field];
    // Solo procesar si contiene un string de base64 (empieza por "data:")
    if (base64Data && typeof base64Data === 'string' && base64Data.indexOf('data:') === 0) {
      const contentType = base64Data.split(';')[0].split(':')[1];
      const base64Content = base64Data.split(',')[1];
      const decodedData = Utilities.base64Decode(base64Content);
      const blob = Utilities.newBlob(decodedData, contentType, fieldNames[field] + "_" + guestId);
      
      // Borrar archivo anterior si existe (opcional)
      const oldFiles = guestFolder.getFilesByName(blob.getName());
      while (oldFiles.hasNext()) {
        oldFiles.next().setTrashed(true);
      }
      
      const file = guestFolder.createFile(blob);
      guestData[field] = file.getUrl(); // Sustituir base64 por la URL de Drive
    }
  });
  
  return guestData;
}
*/
