// utils/errorHandler.js
export const handleAPIError = (error, customMessage = 'Operation failed') => {
  if (error.code === 'NETWORK_ERROR' || !error.response) {
    return 'Network error: Please check your internet connection and ensure the server is running';
  }
  
  if (error.response.status === 500) {
    return 'Server error: Please try again later';
  }
  
  return customMessage;
};

// Usage in components
const loadData = async () => {
  try {
    const response = await api.call();
    setData(response.data);
  } catch (error) {
    const errorMessage = handleAPIError(error, 'Failed to load data');
    setErrorMessage(errorMessage);
  }
};