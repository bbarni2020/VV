import subprocess

def main():
    process1 = subprocess.Popen(['python', 'api.py'])
    process2 = subprocess.Popen(['python', 'user.py'])
if __name__ == "__main__":
    main() 