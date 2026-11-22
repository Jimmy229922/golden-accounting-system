(function () {
    function createInitialState() {
        return {
            ar: {},
            mode: 'login',
            authSessionKey: 'auth_session_token',
            dom: {
                form: null,
                titleText: null,
                subtitleText: null,
                usernameInput: null,
                passwordInput: null,
                passwordToggleBtn: null,
                confirmGroup: null,
                confirmPasswordInput: null,
                submitBtn: null,
                statusEl: null
            }
        };
    }

    function initializeDomRefs(state) {
        state.dom.form = document.getElementById('authForm');
        state.dom.titleText = document.getElementById('titleText');
        state.dom.subtitleText = document.getElementById('subtitleText');
        state.dom.usernameInput = document.getElementById('username');
        state.dom.passwordInput = document.getElementById('password');
        state.dom.passwordToggleBtn = document.getElementById('passwordToggleBtn');
        state.dom.confirmGroup = document.getElementById('confirmGroup');
        state.dom.confirmPasswordInput = document.getElementById('confirmPassword');
        state.dom.submitBtn = document.getElementById('submitBtn');
        state.dom.statusEl = document.getElementById('status');
        return state.dom;
    }

    window.authPageState = {
        createInitialState,
        initializeDomRefs
    };
})();
