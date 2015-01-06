from selenium import webdriver
import time, datetime, os

def snapShotMain():

	ts = time.time()
	st = datetime.datetime.fromtimestamp(ts).strftime('%Y-%m-%d')

	driver = webdriver.Firefox()

	rootPath = os.path.dirname(os.path.realpath(__file__))

	if(os.name == "nt"):
		rootPath = rootPath+"\images\/"
	else:
		rootPath = rootPath+"/images/"

	urlsToWatch = ['http://localhost:1337']

	for url in urlsToWatch:
		safeUrl = url.replace('http://','')
		safeUrl = safeUrl.replace(':1337','')
		driver.get(url)
		driver.save_screenshot(rootPath + st + "-" + str(ts) + "-" + safeUrl + ".png")

	print os.name
	print rootPath + st + "screenshot.png"

	driver.close()


# this will be the control file for running tests/test scripts/etc