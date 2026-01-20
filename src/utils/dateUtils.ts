export function formatDate(dateStr: string): string {
  try {
    const date = new Date(dateStr);
    const options: Intl.DateTimeFormatOptions = {
      weekday: 'long',
      year: 'numeric',
      month: 'numeric',
      day: 'numeric'
    };
    // This will format to something like "יום שני, 21.7.2025"
    return date.toLocaleDateString('he-IL', options);
  } catch (error) {
    console.error('Error formatting date:', error);
    return dateStr;
  }
}

export function formatTime(timeStr: string): string {
  try {
    return timeStr;
  } catch (error) {
    console.error('Error formatting time:', error);
    return timeStr;
  }
}

export function isEventPast(dateStr: string, timeStr: string): boolean {
  try {
    // Check if date has passed (not including current day)
    const eventDate = new Date(dateStr);
    const now = new Date();
    
    // Compare only by date, not by time
    const eventDateOnly = new Date(eventDate.getFullYear(), eventDate.getMonth(), eventDate.getDate());
    const nowDateOnly = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    const isPast = eventDateOnly < nowDateOnly;
    return isPast;
  } catch (error) {
    console.error('Error checking if event is past:', error);
    return false;
  }
}

export function getNextFriday(): string {
  const today = new Date();
  const nextFriday = new Date(today);
  
  // Find next Friday (day 5 in JavaScript, where Sunday is 0)
  const daysUntilFriday = (5 - today.getDay() + 7) % 7;
  nextFriday.setDate(today.getDate() + (daysUntilFriday === 0 ? 7 : daysUntilFriday));
  
  return nextFriday.toISOString().split('T')[0];
}
// Additional function to check if event has ended (including time)
export function isEventFinished(dateStr: string, timeStr: string): boolean {
  try {
    const eventDateTime = new Date(`${dateStr}T${timeStr}`);
    eventDateTime.setHours(eventDateTime.getHours() + 6);
    const now = new Date();
    return eventDateTime < now;
  } catch (error) {
    console.error('Error checking if event is finished:', error);
    return false;
  }
}