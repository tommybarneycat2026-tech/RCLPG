import { seedDefaultAdmin } from '../services/authService.js';

seedDefaultAdmin()
  .then((result) => {
    console.log(result);
    process.exit(0);
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
