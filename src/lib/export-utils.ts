import * as XLSX from 'xlsx'


// --- Excel Export ---

export function exportToExcel(
    filename: string,
    sheets: { name: string; data: any[] }[]
) {
    const wb = XLSX.utils.book_new()

    sheets.forEach((sheet) => {
        const ws = XLSX.utils.json_to_sheet(sheet.data)
        XLSX.utils.book_append_sheet(wb, ws, sheet.name)
    })

    XLSX.writeFile(wb, `${filename}.xlsx`)
}


