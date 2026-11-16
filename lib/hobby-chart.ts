export function getHobbyChartColors(hobbyCount: number) {
  return Array.from({ length: hobbyCount }, (_, index) => {
    const hue = (index * 360) / hobbyCount;
    return `hsl(${hue} 70% 45%)`;
  });
}
