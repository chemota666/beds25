/**
 * Script to generate the empadronamiento authorization .docx template
 * with {placeholders} for docxtemplater.
 * Run once: node scripts/generate-empadronamiento-template.js
 */
import { Document, Packer, Paragraph, TextRun, AlignmentType } from 'docx';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const bold = (text) => new TextRun({ text, bold: true, size: 24, font: 'Calibri' });
const normal = (text) => new TextRun({ text, size: 24, font: 'Calibri' });

const doc = new Document({
  sections: [{
    properties: {
      page: { margin: { top: 1400, bottom: 1400, left: 1200, right: 1200 } }
    },
    children: [
      // Title
      new Paragraph({
        children: [new TextRun({ text: '** AUTORIZACION PARA EMPADRONAMIENTO **', bold: true, size: 26, font: 'Calibri' })],
        alignment: AlignmentType.CENTER,
        spacing: { after: 600 },
      }),
      // Date
      new Paragraph({
        children: [normal('Fecha: {fecha}')],
        spacing: { after: 600 },
      }),
      // Body
      new Paragraph({
        children: [
          normal('Yo, '),
          bold('{ownerName}'),
          normal(', identificado (a) con DNI/NIF: n\u00famero '),
          bold('{ownerDni}'),
          normal(', AUTORIZO a: '),
          bold('D/D\u00aa {guestFullName}'),
          normal(' mayor de edad, con NIE: '),
          bold('{guestDni}'),
          normal(', para empadronarse en el domicilio sito en '),
          bold('{propertyAddress}'),
          normal(', en la ciudad de '),
          bold('{propertyCity}'),
          normal('.'),
        ],
        spacing: { after: 600, line: 360 },
      }),
      // Closing
      new Paragraph({
        children: [normal('Y para que as\u00ed conste, firmado:')],
        spacing: { after: 400 },
      }),
      // Signature
      new Paragraph({
        children: [normal('Fdo. {ownerName}')],
        spacing: { after: 200 },
      }),
    ]
  }]
});

const outPath = path.join(__dirname, '..', 'templates', 'autorizacion-empadronamiento.docx');
Packer.toBuffer(doc).then(buffer => {
  fs.writeFileSync(outPath, buffer);
  console.log('Template generated:', outPath);
});
