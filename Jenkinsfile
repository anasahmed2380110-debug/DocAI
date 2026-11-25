
pipeline {
    agent any

    options {
        skipDefaultCheckout(true)
    }

    stages {

        stage('Checkout') {
            steps {
                echo 'Downloading latest DocAI code from GitHub'
                checkout scm
            }
        }

        stage('Backend Setup') {
            steps {
                dir('backend') {
                    bat 'python --version'
                    bat 'python -m pip install -r requirements.txt'
                }
            }
        }

        stage('Backend Validation') {
            steps {
                bat 'python -m compileall -q backend'
                echo 'Backend Python validation successful'
            }
        }

        stage('Frontend Install') {
            steps {
                dir('frontend') {
                    bat 'node --version'
                    bat 'npm --version'
                    bat 'npm ci'
                }
            }
        }

        stage('Frontend Lint') {
            steps {
                dir('frontend') {
                    bat 'npm run lint'
                }
            }
        }

        stage('Frontend Build') {
            steps {
                dir('frontend') {
                    bat 'npm run build'
                }
            }
        }
    }

    post {
        success {
            echo 'DocAI Pipeline completed successfully!'
        }

        failure {
            echo 'DocAI Pipeline failed. Check Console Output.'
        }

        always {
            echo 'Pipeline execution finished.'
        }
    }
}
