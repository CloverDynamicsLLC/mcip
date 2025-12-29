# Contributing to MCIP

Thank you for your interest in contributing to MCIP (Machine Customer Interaction Protocol)! We welcome contributions from the community to help improve this project.

## How to Contribute

### Reporting Bugs

If you find a bug, please create a new issue in the repository. Be sure to include:

- A clear, descriptive title.
- Steps to reproduce the issue.
- Expected behavior vs. actual behavior.
- Screenshots or logs if applicable.

### Suggesting Enhancements

We welcome ideas for new features or improvements. Please submit an issue with the "enhancement" label and describe your idea in detail.

### Pull Requests

1.  **Fork the repository** and clone it to your local machine.
2.  **Create a new branch** for your feature or bug fix: `git checkout -b feature/your-feature-name` or `git checkout -b fix/issue-number`.
3.  **Make your changes**, ensuring you follow the project's coding standards.
4.  **Run tests and linting** to ensure your changes don't break anything:
    ```bash
    npm run lint
    npm run test
    ```
5.  **Commit your changes** with clear, descriptive commit messages.
6.  **Push to your fork** and submit a **Pull Request** to the `main` branch.

## Coding Standards

- We use **ESLint** and **Prettier** to maintain code quality. Please run `npm run format` before committing.
- Follow **NestJS** best practices and architecture patterns.
- Ensure all new features are covered by unit tests where possible.

## Code of Conduct

Please note that we have a [Code of Conduct](./CODE_OF_CONDUCT.md). By participating in this project, you agree to abide by its terms.
