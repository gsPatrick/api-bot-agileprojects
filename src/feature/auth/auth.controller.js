const authService = require('./auth.service');
const response = require('../../utils/response.utils');

class AuthController {
    async register(req, res) {
        try {
            const { name, email, password } = req.body;
            const user = await authService.register(name, email, password);
            return response.success(res, user, 'User registered successfully', 201);
        } catch (error) {
            return response.error(res, error.message, 400);
        }
    }

    async login(req, res) {
        try {
            const { email, password } = req.body;
            const data = await authService.login(email, password);
            return response.success(res, data, 'Login successful');
        } catch (error) {
            return response.error(res, error.message, 401);
        }
    }
}

module.exports = new AuthController();
