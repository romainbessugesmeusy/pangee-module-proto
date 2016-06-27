<?php

$tmpFileName = 'tmp.csv';
$fetchFromGoogleDocs = strtolower($argv[1]) === 'y';
$spreadsheetId = "1Ng2W0JjRaNSuxVBw1eu9EwGknhSP6YXoD3O16VKZrnY";
$url = "https://docs.google.com/feeds/download/spreadsheets/Export?key=$spreadsheetId&exportFormat=csv&gid=0";


if($fetchFromGoogleDocs){
	file_put_contents($tmpFileName, file_get_contents($url));
}


function createEntity($rows){

	$entity = [];
	$inArray = false;
	$firstRow = true;

	foreach($rows as $row){

		if($firstRow){
			$entity['ID'] = $row[1];
			$entity['type'] = $row[2];
			$entity['extends'] = ($row[3]) ? "[" . $row[3] . "]" : null;
			$firstRow = false;
			continue;
		}

		if(strpos($row[0], '[]') === FALSE && $row[0] !== ''){
			$entity[$row[0]] = createValue($row[1]);
		} else {
			if($inArray === false){
				$arrayProp = substr($row[0], 0, -2);
				$entity[$arrayProp] = [];
				$props = $row;
				$inArray = true;
			} else {
				$first = true;
				$arrayValue = [];
				foreach($row as $i => $value){
					if($first){
						$first = false;
					} else {
						$itemProp = $props[$i];
						if(strpos($itemProp, '.') === false){
							$arrayValue[$itemProp] = createValue($value);	
						} else {
							$path = explode('.', $itemProp);
							$ref = &$arrayValue;
							foreach($path as $fragment){
								if(!is_array($ref)){
									$ref = [];
								}
								$ref = &$ref[$fragment];
							}
							$ref = createValue($value);
						}

						
					}
				}
				$entity[$arrayProp][] = array_filter($arrayValue);
			}
		}
	}

	return $entity;
}

function createValue($value){
	preg_match_all('#json\((.*)\)#', $value, $matches);
	if(count($matches[1])){
		return json_decode($matches[1][0]);
	}
	preg_match_all('#obj\((.*)\)#', $value, $matches);
	if(count($matches[1])){
		$arr = [];
		$props = explode(',', $matches[1][0]);

		foreach($props as $prop){
			$parts = explode(':', $prop);
			$arr[trim($parts[0])] = trim($parts[1]);
		}
		return $arr;

	}
	return $value;
}

$entities = [];
$currentEntity;

$handle = fopen($tmpFileName, 'r');

while(($row = fgetcsv($handle, NULL, ',')) !== FALSE){
	if($row[0] === '' && $row[1] === ''){
		continue;
	}

	if($row[0] == 'ID'){
		$currentEntity = $row[1];
		$entities[$currentEntity] = [];
	}

	$entities[$currentEntity][] = $row;
}



$json = [];

foreach ($entities as $id => $rows) {
	$entity = createEntity($rows);
	$json[$entity['ID']] = $entity;
}

$json = json_encode($json, JSON_PRETTY_PRINT|JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES|JSON_NUMERIC_CHECK);

file_put_contents('panjee.json', $json);

echo $json;