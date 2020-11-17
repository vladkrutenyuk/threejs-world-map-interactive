import {
    Mesh,
    PlaneGeometry,
    TextureLoader,
    Scene,
    MeshPhongMaterial,
    Group,
    MathUtils,
    BufferGeometry,
    Float32BufferAttribute,
    PointsMaterial,
    Points,
} from "three";
import { Marker, MarkerData } from "./Marker";

export class Map {
    private _mesh: Mesh;
    public get mesh() { return this._mesh };
    private _geometry: PlaneGeometry;
    public get width() { return this._geometry.parameters.width };
    public get height() { return this._geometry.parameters.height };
    private _material: MeshPhongMaterial;

    private readonly _scene: Scene;

    private _markersGroup: Group = new Group();
    public get markersGroup() { return this._markersGroup };

    constructor(scene: Scene) {
        this._scene = scene;
        this.init();
    }

    private init = (): void => {
        this._geometry = new PlaneGeometry(3.6, 1.8, 140, 70);
        this._material = new MeshPhongMaterial({
            map: new TextureLoader().load("img/world_color.jpg"),
            specularMap: new TextureLoader().load("img/world_specular.jpg"),
            displacementMap: new TextureLoader().load("img/world_height.jpg"),
            displacementBias: -0.25,
            displacementScale: 0.45,
            wireframe: true,
            transparent: true,
            opacity: 0.6
        })
        // this._material.map.center.set(0.5, 0.5);
        this._mesh = new Mesh(this._geometry, this._material);
        this._scene.add(this._mesh);

        this._scene.add(this._markersGroup);

        this.initStars();
    }

    private initStars = (): void => {
        const vertices = [];
        const range = 50;
        for (let i = 0; i < 10000; i++) {
            const x = MathUtils.randFloatSpread(range);
            const y = MathUtils.randFloatSpread(range);
            const z = MathUtils.randFloatSpread(range);

            if (Math.sqrt(x*x + y*y + z*z) > 5) vertices.push(x, y, z);
        }

        const geometry = new BufferGeometry();
        geometry.setAttribute('position', new Float32BufferAttribute(vertices, 3));
        const material = new PointsMaterial( { color: 0x505050, size: 0.08 } );
        this._scene.add(new Points(geometry, material));
    }

    public initMarkers = async (jsonDataUrl: string): Promise<void> => {
        const jsonDataResponse = await fetch(jsonDataUrl);
        const jsonDataText = await jsonDataResponse.text();

        const markersData: MarkerData[] = JSON.parse(jsonDataText);

        try {
            await markersData.forEach((markerData) => {
                console.log("Marker <<" + markerData.title + ">> was inited");
                let marker = new Marker(markerData);
                marker.initOnMap(
                    this._scene,
                    this.width, this.height,
                    this._material.displacementScale,
                    this._material.displacementBias);
                this._markersGroup.add(marker.colliderMesh);
            })
        } catch (e) {
            console.log(e);
        }
    }

    public goToMarker = (x: number, y: number): void => {
        this._material.map.center.set(x, y);
        this._material.map.repeat.setScalar(0.1);
    }

    // private getMapScale = (): number => {
    //     return 1 / this._material.map.repeat.x;
    // }
    //
    // private getOffsetLimit = (): number => {
    //     return (this.getMapScale() * 0.5 - 0.5) / this.getMapScale();
    // }
    //
    // private offsetMap = (valueX: number, valueY: number): void => {
    //     this._material.map.offset
    //         .set(this._material.map.offset.x + valueX, this._material.map.offset.y + valueY)
    //
    //     this.fixOffsetMap()
    // }
    //
    // private scaleMap = (value: number): void => {
    //     this._material.map.repeat.addScalar(value).clampScalar(0.1, 1)
    //
    //     this.fixOffsetMap()
    //
    //     this._markersGroup.scale.setScalar(this.getMapScale())
    // }
    //
    // private fixOffsetMap = (): void => {
    //     this._material.map.offset.clampScalar(-this.getOffsetLimit(), this.getOffsetLimit())
    //
    //     this._markersGroup.position.x = -this._material.map.offset.x * this._geometry.parameters.width * this.getMapScale()
    //     this._markersGroup.position.y = -this._material.map.offset.y * this._geometry.parameters.height * this.getMapScale()
    // }
}