document.getElementById('login-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;
    fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            localStorage.setItem('username', username);
            window.location.href = 'client.html';
        } else {
            alert(data.message || 'Invalid credentials');
            loginForm.reset();
        }
    })
    .catch(error => {
        console.error('Login error:', error);
        alert('An error occurred during login.');
    });
});

fetch('/api/create-account', {
    method: 'POST',
    body: JSON.stringify({ username, password }),
    headers: { 'Content-Type': 'application/json' }
  })
  .then(response => {
    console.log('Register response status:', response.status);
    if (response.ok) {
      return response.json(); // Only parse JSON if the response is successful
    } else {
      throw new Error(`Server returned ${response.status}`);
    }
  })
  .then(data => console.log('Success:', data))
  .catch(error => {
    console.error('Registration error:', error);
    // Optionally fetch the text to debug
    response.text().then(text => console.log('Response body:', text));
  });