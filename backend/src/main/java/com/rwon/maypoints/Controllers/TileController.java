package com.rwon.maypoints.Controllers;

import com.rwon.maypoints.Entities.Tile;
import com.rwon.maypoints.Repository.TileRepository;
import jakarta.servlet.http.HttpServletResponse;
import org.bson.types.ObjectId;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.data.mongodb.gridfs.GridFsOperations;
import org.springframework.data.mongodb.gridfs.GridFsResource;
import org.springframework.data.mongodb.gridfs.GridFsTemplate;
import org.springframework.http.ResponseEntity;
import org.springframework.util.StreamUtils;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.util.List;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@RestController
@RequestMapping("/tiles")
@CrossOrigin(origins = "*")

public class TileController {

    @Autowired
    private GridFsTemplate gridFsTemplate;
    @Autowired private GridFsOperations gridFsOperations;
    @Autowired private TileRepository tileRepository;

    @PostMapping
    public ResponseEntity<?> upload(@RequestParam("file") MultipartFile file) throws IOException {
        String filename = file.getOriginalFilename();

        // Parse x and z from filename
        Pattern p = Pattern.compile("x(-?\\d+)_z(-?\\d+)");
        Matcher m = p.matcher(filename);
        if (!m.find()) return ResponseEntity.badRequest().body("Invalid filename");

        int x = Integer.parseInt(m.group(1));
        int z = Integer.parseInt(m.group(2));

        // Skip duplicate tiles
        if (tileRepository.existsByXAndZ(x, z))
            return ResponseEntity.ok().body("Already exists");

        // Store file in GridFS
        ObjectId gridFsId = gridFsTemplate.store(
                file.getInputStream(), filename, "image/png"
        );

        Tile tile = new Tile(filename, x, z, gridFsId.toString());
        tileRepository.save(tile);

        System.out.println("Stored GridFS ID: " + gridFsId.toHexString() + " length: " + gridFsId.toHexString().length());

        return ResponseEntity.ok(tile);
    }

    @GetMapping
    public List<Tile> getAllTiles() {
        return tileRepository.findAll();
    }

    @GetMapping("/files/{gridFsId}")
    public void getFile(@PathVariable String gridFsId, HttpServletResponse response) throws IOException {
        GridFsResource resource = gridFsOperations.getResource(
                gridFsTemplate.findOne(new Query(Criteria.where("_id").is(new ObjectId(gridFsId))))
        );
        response.setContentType("image/png");
        StreamUtils.copy(resource.getInputStream(), response.getOutputStream());
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<?> delete(@PathVariable String id) {
        tileRepository.findById(id).ifPresent(tile -> {
            gridFsTemplate.delete(new Query(Criteria.where("_id").is(new ObjectId(tile.getGridFsId()))));
            tileRepository.deleteById(id);
        });
        return ResponseEntity.ok().build();
    }
}