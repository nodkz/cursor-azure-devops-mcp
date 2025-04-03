/**
 * Cleans up a work item returned by ADO rest api, to save tokens
 * by removing unwanted properties.
 */
export function keepWISystemFields(workItem: any): any {
  // Remove unwanted properties
  const { fields, ...rest } = workItem;

  // check if fields is an object and remove all properties that are not system fields
  if (fields && typeof fields === 'object') {
    for (const key in fields) {
      if (fields.hasOwnProperty(key)) {
        // Check if the field is a system field
        if (!key.startsWith('System.')) {
          delete fields[key];
        }

        // Check if value is object and remove _links, imageUrl, descriptor
        if (typeof fields[key] === 'object') {
          delete fields[key]._links;
          delete fields[key].url;
          delete fields[key].imageUrl;
          delete fields[key].descriptor;
        }
      }
    }
  }

  // Return a new object with only the desired properties
  return {
    ...rest,
    fields,
  };
}

/**
 * Truncates long strings in object, arrays, and nested objects to a specified limit.
 * This is useful for saving tokens when sending data to the client.
 */
export function truncateLongStrings(data: any, limit: number = 500): any {
  if (typeof data === 'string') {
    return data.length > limit ? `${data.substring(0, limit)}...` : data;
  } else if (Array.isArray(data)) {
    return data.map(item => truncateLongStrings(item, limit));
  } else if (typeof data === 'object' && data !== null) {
    for (const key in data) {
      if (data.hasOwnProperty(key)) {
        data[key] = truncateLongStrings(data[key], limit);
      }
    }
  }
  return data;
}
