const XLSX = require('xlsx');
const path = require('path');

const filePath = 'C:/Users/compu/Documents/Jeeves-expenses/Historicos/______Jeeves - Prima______ enero.xlsx';

try {
  const workbook = XLSX.readFile(filePath);
  const sheetNames = workbook.SheetNames;
  
  const targetSheetName = '#83 Montserrat Camacho';
  console.log("INSPECTING SHEET:", targetSheetName);

  if (sheetNames.includes(targetSheetName)) {
    const sheet = workbook.Sheets[targetSheetName];
    const data = XLSX.utils.sheet_to_json(sheet, { header: 1 });
    console.log("FIRST 15 ROWS:");
    console.log(JSON.stringify(data.slice(0, 15), null, 2));
  } else {
    console.log("Sheet not found.");
  }
} catch (error) {
  console.error("ERROR:", error.message);
}
