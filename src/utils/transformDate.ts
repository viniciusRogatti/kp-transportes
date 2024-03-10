function transformDate(dateString: string): string {
  // Divide a string da data em partes separadas
  const parts = dateString.split('-');

  // Reorganiza as partes da data
  const year = parts[0];
  const month = parts[1];
  const day = parts[2];

  // Concatena as partes da data no novo formato
  const newDateFormat = `${day}-${month}-${year}`;

  return newDateFormat;
}

export default transformDate;

