const bcrypt = require('bcryptjs');

const newPassword = 'yourNewAdminPassword123'; // Replace with your desired password
bcrypt.hash(newPassword, 10, (err, hash) => {
  if (err) {
    console.error('Error hashing password:', err);
  } else {
    console.log('New password hash:', hash);
  }
});