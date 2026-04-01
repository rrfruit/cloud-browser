const tokenKey = "token-admin";

export function setToken(token: string) {
  localStorage.setItem(tokenKey, token);
}

export function getToken() {
  return localStorage.getItem(tokenKey);
}

export function removeToken() {
  localStorage.removeItem(tokenKey);
}
